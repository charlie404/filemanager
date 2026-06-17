<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use GdImage;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use RuntimeException;
use Symfony\Component\HttpFoundation\File\UploadedFile;

/**
 * Reference Laravel backend for the @charlie404/filemanager `<file-manager>`
 * custom element. It implements the full REST contract over the `public` disk,
 * rooted at a `media/` directory — files live in `storage/app/public/media` and
 * are served at `/storage/media/...` once `php artisan storage:link` has run.
 *
 * No database is required: per-file descriptive metadata (`alt`, `title`) is kept
 * in a per-folder sidecar `.meta.json`. Image cropping is done server-side with
 * GD and is non-destructive (a new `<stem>-<w>x<h>.<ext>` derivative is written,
 * the original is untouched).
 *
 * The JSON shapes returned here are byte-identical to the framework-agnostic dev
 * server shipped in the library (`server/router.php`) and to `src/types.ts`:
 *   Folder   = {id, name, parent}
 *   FileItem = {id, name, url, folder, thumbnail, size, mtime, meta:{alt, title}}
 */
final class FileManagerController extends Controller
{
    /** Directory under the `public` disk that holds all managed media. */
    private const ROOT = 'media';

    /** Extensions GD can decode (used for cropping). */
    private const RASTER = ['jpg', 'jpeg', 'png', 'gif', 'webp'];

    /** Extensions treated as previewable images (thumbnail = the file itself). */
    private const IMAGE = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif', 'svg', 'bmp', 'ico'];

    // -- folders -------------------------------------------------------------

    /** GET /folders -> Folder[] */
    public function listFolders(): JsonResponse
    {
        $disk = Storage::disk('public');
        $out = [];

        foreach ($disk->allDirectories(self::ROOT) as $dir) {
            $id = $this->relId($dir);
            $parent = $this->parentId($id);
            $out[] = [
                'id' => $id,
                'name' => basename($id),
                'parent' => $parent,
            ];
        }

        return $this->json($out);
    }

    /** POST /folders {name, parent} -> Folder */
    public function createFolder(Request $request): JsonResponse
    {
        $name = $this->slug((string) $request->input('name', 'folder'));
        $parent = $this->normalizeFolder($request->input('parent'));

        $relParent = $parent !== null ? $this->safeRel($parent) : '';
        if ($parent !== null && $relParent === null) {
            return $this->error('Bad parent folder');
        }

        $base = $relParent !== '' ? $relParent : self::ROOT;
        $dir = $this->dedupe($base . '/' . $name, true);

        Storage::disk('public')->makeDirectory($dir);

        $id = $this->relId($dir);

        return $this->json([
            'id' => $id,
            'name' => basename($id),
            'parent' => $parent,
        ]);
    }

    /** PUT /folders/{id} {name} -> Folder */
    public function renameFolder(Request $request, string $id): JsonResponse
    {
        $rel = $this->safeRel($id);
        $disk = Storage::disk('public');
        if ($rel === null || ! $disk->directoryExists($rel)) {
            return $this->error('Folder not found');
        }

        $name = $this->slug((string) $request->input('name', ''));
        $parentDir = $this->parentDir($rel);
        $target = $this->dedupe($parentDir . '/' . $name, true);

        $this->moveDirectory($rel, $target);

        $newId = $this->relId($target);

        return $this->json([
            'id' => $newId,
            'name' => basename($newId),
            'parent' => $this->parentId($newId),
        ]);
    }

    /** DELETE /folders/{id} -> 204 */
    public function deleteFolder(string $id): Response
    {
        $rel = $this->safeRel($id);
        $disk = Storage::disk('public');
        if ($rel !== null && $disk->directoryExists($rel)) {
            $disk->deleteDirectory($rel);
        }

        return $this->noContent();
    }

    // -- files ---------------------------------------------------------------

    /** GET /files?folder=ID -> FileItem[] */
    public function listFiles(Request $request): JsonResponse
    {
        $folder = $this->normalizeFolder($request->query('folder'));
        $rel = $folder !== null ? $this->safeRel($folder) : self::ROOT;
        $disk = Storage::disk('public');

        if ($rel === null || ! $disk->directoryExists($rel)) {
            return $this->json([]);
        }

        $meta = $this->readMeta($folder);
        $out = [];

        foreach ($disk->files($rel) as $path) {
            $name = basename($path);
            if (str_starts_with($name, '.')) {
                continue; // skip the .meta.json sidecar and dotfiles
            }
            $out[] = $this->fileItem($folder, $name, $meta[$name] ?? []);
        }

        return $this->json($out);
    }

    /** POST /files (multipart: file, folder) -> FileItem */
    public function uploadFile(Request $request): JsonResponse
    {
        $upload = $request->file('file');
        if (! $upload instanceof UploadedFile) {
            return $this->error('No file');
        }

        $folder = $this->normalizeFolder($request->input('folder'));
        $rel = $folder !== null ? $this->safeRel($folder) : self::ROOT;
        $disk = Storage::disk('public');
        if ($rel === null || ! $disk->directoryExists($rel)) {
            return $this->error('Bad folder');
        }

        $name = $this->slugName($upload->getClientOriginalName());
        $dest = $this->dedupe($rel . '/' . $name, false);

        $disk->putFileAs(dirname($dest), $upload, basename($dest));

        return $this->json($this->fileItem($folder, basename($dest), []));
    }

    /** PUT /files/{id} {name?, meta?} -> FileItem */
    public function updateFile(Request $request, string $id): JsonResponse
    {
        $rel = $this->safeRel($id);
        $disk = Storage::disk('public');
        if ($rel === null || ! $disk->fileExists($rel)) {
            return $this->error('File not found');
        }

        $folder = $this->parentId($this->relId($rel));
        $name = basename($rel);

        $newNameInput = $request->input('name');
        if (is_string($newNameInput) && $newNameInput !== '') {
            $ext = pathinfo($rel, PATHINFO_EXTENSION);
            $newName = $this->slug(pathinfo($newNameInput, PATHINFO_FILENAME))
                . ($ext !== '' ? '.' . $ext : '');
            $dest = $this->dedupe(dirname($rel) . '/' . $newName, false);
            $old = $name;

            $disk->move($rel, $dest);
            $rel = $dest;
            $name = basename($dest);

            // carry metadata across the rename
            $all = $this->readMeta($folder);
            if (isset($all[$old])) {
                $all[$name] = $all[$old];
                unset($all[$old]);
                $this->writeMeta($folder, $all);
            }
        }

        if ($request->exists('meta')) {
            $meta = $request->input('meta');
            $this->setMeta($this->joinId($folder, $name), is_array($meta) ? $meta : null);
        }

        return $this->json(
            $this->fileItem($folder, $name, $this->readMeta($folder)[$name] ?? []),
        );
    }

    /** POST /files/move {from, to} -> FileItem */
    public function moveFile(Request $request): JsonResponse
    {
        $from = $this->safeRel((string) $request->input('from', ''));
        $disk = Storage::disk('public');
        if ($from === null || ! $disk->fileExists($from)) {
            return $this->error('File not found');
        }

        $to = $this->normalizeFolder($request->input('to'));
        $destDir = $to !== null ? $this->safeRel($to) : self::ROOT;
        if ($destDir === null || ! $disk->directoryExists($destDir)) {
            return $this->error('Bad target folder');
        }

        $name = basename($from);
        $dest = $this->dedupe($destDir . '/' . $name, false);

        // move the metadata entry alongside the file
        $fromFolder = $this->parentId($this->relId($from));
        $all = $this->readMeta($fromFolder);
        $carried = $all[$name] ?? null;
        if ($carried !== null) {
            unset($all[$name]);
            $this->writeMeta($fromFolder, $all);
        }

        $disk->move($from, $dest);

        if ($carried !== null) {
            $this->setMeta($this->joinId($to, basename($dest)), $carried);
        }

        return $this->json($this->fileItem($to, basename($dest), $carried ?? []));
    }

    /** DELETE /files/{id} -> 204 */
    public function deleteFile(string $id): Response
    {
        $rel = $this->safeRel($id);
        $disk = Storage::disk('public');
        if ($rel !== null && $disk->fileExists($rel)) {
            $this->setMeta($this->relId($rel), null);
            $disk->delete($rel);
        }

        return $this->noContent();
    }

    /**
     * POST /files/crop {source, crop:{x,y,width,height}, format?, quality?, maxWidth?}
     *  -> FileItem
     *
     * Server-side, non-destructive crop using GD. The crop rect is expressed in
     * the natural pixels of the source image. A new derivative is written next to
     * the source as `<stem>-<w>x<h>.<ext>`; the original is preserved.
     */
    public function cropFile(Request $request): JsonResponse
    {
        $source = $this->safeRel((string) $request->input('source', ''));
        $disk = Storage::disk('public');
        if ($source === null || ! $disk->fileExists($source)) {
            return $this->error('Source not found');
        }

        $crop = (array) $request->input('crop', []);
        $x = (int) ($crop['x'] ?? 0);
        $y = (int) ($crop['y'] ?? 0);
        $w = (int) ($crop['width'] ?? 0);
        $h = (int) ($crop['height'] ?? 0);
        if ($w <= 0 || $h <= 0) {
            return $this->error('Invalid crop');
        }

        $absSource = Storage::disk('public')->path($source);
        $srcExt = strtolower(pathinfo($absSource, PATHINFO_EXTENSION));

        try {
            $image = $this->loadImage($absSource, $srcExt);
            $cropped = imagecrop($image, ['x' => $x, 'y' => $y, 'width' => $w, 'height' => $h]);
            imagedestroy($image);
            if ($cropped === false) {
                return $this->error('Crop failed');
            }

            $maxWidth = (int) $request->input('maxWidth', 0);
            if ($maxWidth > 0 && imagesx($cropped) > $maxWidth) {
                $scaled = imagescale($cropped, $maxWidth);
                if ($scaled !== false) {
                    imagedestroy($cropped);
                    $cropped = $scaled;
                }
            }

            $format = $request->input('format');
            $outExt = in_array($format, ['jpeg', 'png', 'webp'], true)
                ? ($format === 'jpeg' ? 'jpg' : $format)
                : $srcExt;

            $quality = $request->has('quality')
                ? (int) round(((float) $request->input('quality')) * 100)
                : 82;

            $folder = $this->parentId($this->relId($source));
            $stem = pathinfo($absSource, PATHINFO_FILENAME);
            $dest = $this->dedupe(dirname($source) . "/{$stem}-{$w}x{$h}.{$outExt}", false);

            $this->saveImage($cropped, Storage::disk('public')->path($dest), $outExt, $quality);
            imagedestroy($cropped);
        } catch (RuntimeException $e) {
            return $this->error($e->getMessage());
        }

        return $this->json($this->fileItem($folder, basename($dest), []));
    }

    // -- presentation --------------------------------------------------------

    /**
     * Build the canonical FileItem shape for a stored file.
     *
     * @param  array<string, mixed>  $meta
     * @return array<string, mixed>
     */
    private function fileItem(?string $folder, string $name, array $meta): array
    {
        $id = $this->joinId($folder, $name);
        $rel = self::ROOT . '/' . $id;
        $disk = Storage::disk('public');
        $exists = $disk->fileExists($rel);

        return [
            'id' => $id,
            'name' => $name,
            'url' => $this->publicUrl($id),
            'folder' => $folder,
            'thumbnail' => $this->isImageName($name)
                ? $this->publicUrl($id)
                : $this->placeholderThumb(),
            'size' => $exists ? $disk->size($rel) : 0,
            'mtime' => $exists ? $disk->lastModified($rel) : 0,
            'meta' => [
                'alt' => $meta['alt'] ?? '',
                'title' => $meta['title'] ?? '',
            ],
        ];
    }

    /** Public URL for an id under the media root, e.g. `/storage/media/products/a.jpg`. */
    private function publicUrl(string $id): string
    {
        $encoded = implode('/', array_map('rawurlencode', explode('/', $id)));

        return Storage::disk('public')->url(self::ROOT . '/' . $encoded);
    }

    private function placeholderThumb(): string
    {
        return 'data:image/svg+xml,' . rawurlencode(
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" '
            . 'stroke="gray" stroke-width="1.5"><path d="M14 3v4a1 1 0 0 0 1 1h4"/>'
            . '<path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2Z"/></svg>',
        );
    }

    // -- GD image helpers ----------------------------------------------------

    private function loadImage(string $path, string $ext): GdImage
    {
        if (! in_array($ext, self::RASTER, true)) {
            throw new RuntimeException('Unsupported image format: ' . $ext);
        }

        $image = match ($ext) {
            'jpg', 'jpeg' => @imagecreatefromjpeg($path),
            'png' => @imagecreatefrompng($path),
            'gif' => @imagecreatefromgif($path),
            'webp' => @imagecreatefromwebp($path),
            default => false,
        };

        if (! $image instanceof GdImage) {
            throw new RuntimeException('Could not read image');
        }

        return $image;
    }

    private function saveImage(GdImage $image, string $dest, string $ext, int $quality): void
    {
        match ($ext) {
            'jpg', 'jpeg' => imagejpeg($image, $dest, $quality),
            'png' => $this->savePng($image, $dest),
            'webp' => imagewebp($image, $dest, $quality),
            'gif' => imagegif($image, $dest),
            default => throw new RuntimeException('Unsupported output format: ' . $ext),
        };
    }

    private function savePng(GdImage $image, string $dest): void
    {
        imagealphablending($image, false);
        imagesavealpha($image, true);
        imagepng($image, $dest);
    }

    // -- metadata sidecar ----------------------------------------------------

    private function metaPath(?string $folder): string
    {
        $rel = $folder !== null ? $this->safeRel($folder) : self::ROOT;

        return ($rel ?? self::ROOT) . '/.meta.json';
    }

    /**
     * Read a folder's sidecar metadata, keyed by file name.
     *
     * @return array<string, array<string, mixed>>
     */
    private function readMeta(?string $folder): array
    {
        $path = $this->metaPath($folder);
        $disk = Storage::disk('public');
        if (! $disk->fileExists($path)) {
            return [];
        }

        $decoded = json_decode((string) $disk->get($path), true);

        return is_array($decoded) ? $decoded : [];
    }

    /** @param  array<string, array<string, mixed>>  $meta */
    private function writeMeta(?string $folder, array $meta): void
    {
        $path = $this->metaPath($folder);
        $disk = Storage::disk('public');

        if ($meta === []) {
            if ($disk->fileExists($path)) {
                $disk->delete($path);
            }

            return;
        }

        $disk->put(
            $path,
            (string) json_encode($meta, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES),
        );
    }

    /**
     * Set or clear the metadata entry for a single file id.
     *
     * @param  array<string, mixed>|null  $meta
     */
    private function setMeta(string $fileId, ?array $meta): void
    {
        $folder = $this->parentId($fileId);
        $name = basename($fileId);
        $all = $this->readMeta($folder);

        if ($meta === null) {
            unset($all[$name]);
        } else {
            $entry = array_filter([
                'alt' => $meta['alt'] ?? '',
                'title' => $meta['title'] ?? '',
            ], static fn (mixed $v): bool => $v !== '');

            if ($entry === []) {
                unset($all[$name]);
            } else {
                $all[$name] = $entry;
            }
        }

        $this->writeMeta($folder, $all);
    }

    // -- id / path utilities -------------------------------------------------

    /** Strip the media root from a disk-relative path to produce a contract id. */
    private function relId(string $rel): string
    {
        $rel = ltrim(str_replace('\\', '/', $rel), '/');
        if ($rel === self::ROOT) {
            return '';
        }
        if (str_starts_with($rel, self::ROOT . '/')) {
            $rel = substr($rel, strlen(self::ROOT) + 1);
        }

        return trim($rel, '/');
    }

    /** Parent folder id of an id, or null at the root. */
    private function parentId(string $id): ?string
    {
        $parent = dirname($id);

        return ($parent === '.' || $parent === '' || $parent === '/') ? null : $parent;
    }

    /** Disk-relative parent directory of a disk-relative path. */
    private function parentDir(string $rel): string
    {
        $parent = dirname($rel);

        return $parent === '.' ? self::ROOT : $parent;
    }

    /** Join a folder id and a file name into a contract id. */
    private function joinId(?string $folder, string $name): string
    {
        return trim(($folder !== null ? $folder . '/' : '') . $name, '/');
    }

    /** Treat empty-string / whitespace folder ids as the root (null). */
    private function normalizeFolder(mixed $value): ?string
    {
        if (! is_string($value)) {
            return null;
        }
        $value = trim($value);

        return $value === '' ? null : $value;
    }

    /**
     * Resolve a contract id to a disk-relative path under the media root, refusing
     * anything that would escape it (path traversal guard). Returns null if unsafe.
     */
    private function safeRel(string $id): ?string
    {
        $id = str_replace('\\', '/', $id);
        $id = trim($id, '/');
        if ($id === '' || str_contains($id, "\0")) {
            return $id === '' ? self::ROOT : null;
        }

        // Reject any traversal segment up front.
        foreach (explode('/', $id) as $segment) {
            if ($segment === '..' || $segment === '.') {
                return null;
            }
        }

        $rel = self::ROOT . '/' . $id;

        // Belt-and-braces: verify the resolved real path stays under the root.
        $disk = Storage::disk('public');
        $rootReal = realpath($disk->path(self::ROOT));
        $targetReal = realpath($disk->path($rel));
        if ($rootReal !== false && $targetReal !== false) {
            $prefix = rtrim($rootReal, DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR;
            if ($targetReal !== $rootReal && ! str_starts_with($targetReal, $prefix)) {
                return null;
            }
        }

        return $rel;
    }

    /**
     * Produce a unique disk-relative path by appending `-1`, `-2`, … on collision.
     */
    private function dedupe(string $rel, bool $isDir): string
    {
        $disk = Storage::disk('public');
        $exists = static fn (string $p): bool => $isDir
            ? $disk->directoryExists($p)
            : $disk->fileExists($p);

        if (! $exists($rel)) {
            return $rel;
        }

        $dir = dirname($rel);
        $name = $isDir ? basename($rel) : pathinfo($rel, PATHINFO_FILENAME);
        $ext = $isDir ? '' : '.' . pathinfo($rel, PATHINFO_EXTENSION);

        $i = 1;
        do {
            $candidate = "{$dir}/{$name}-{$i}{$ext}";
            $i++;
        } while ($exists($candidate));

        return $candidate;
    }

    /** Recursively move a directory on the public disk (Flysystem has no native op). */
    private function moveDirectory(string $from, string $to): void
    {
        $disk = Storage::disk('public');
        $disk->makeDirectory($to);

        foreach ($disk->allFiles($from) as $file) {
            $relative = ltrim(substr($file, strlen($from)), '/');
            $disk->move($file, $to . '/' . $relative);
        }
        foreach ($disk->allDirectories($from) as $dir) {
            $relative = ltrim(substr($dir, strlen($from)), '/');
            $disk->makeDirectory($to . '/' . $relative);
        }

        $disk->deleteDirectory($from);
    }

    /** Slug a file name: slug the stem, keep a lowercased extension. */
    private function slugName(string $original): string
    {
        $ext = strtolower(pathinfo($original, PATHINFO_EXTENSION));
        $stem = $this->slug(pathinfo($original, PATHINFO_FILENAME));

        return $stem . ($ext !== '' ? '.' . $ext : '');
    }

    private function slug(string $value): string
    {
        $slug = Str::slug($value);

        return $slug !== '' ? $slug : 'file';
    }

    private function isImageName(string $name): bool
    {
        return in_array(strtolower(pathinfo($name, PATHINFO_EXTENSION)), self::IMAGE, true);
    }

    // -- responses -----------------------------------------------------------

    /**
     * Emit JSON with unescaped slashes so ids/urls read naturally — matching the
     * reference server.
     *
     * @param  array<mixed>  $data
     */
    private function json(array $data, int $status = 200): JsonResponse
    {
        return response()->json($data, $status, [], JSON_UNESCAPED_SLASHES);
    }

    private function error(string $message, int $status = 400): JsonResponse
    {
        return $this->json(['error' => $message], $status);
    }

    private function noContent(): Response
    {
        return response()->noContent();
    }
}
