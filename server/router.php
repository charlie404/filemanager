<?php

/**
 * Dev/test backend for @charlie404/filemanager — implements the full REST
 * contract over a plain filesystem (storage root: server/uploads). It is the
 * reference the framework examples mirror. Run via:
 *   php -S 0.0.0.0:8000 server/router.php
 *
 * Routes are served under /api, uploaded files under /uploads. Metadata lives in
 * a per-folder sidecar `.meta.json`, so no database is required.
 */

declare(strict_types=1);

const ROOT = __DIR__ . '/uploads';

if (!is_dir(ROOT)) {
    mkdir(ROOT, 0775, true);
}

$method = $_SERVER['REQUEST_METHOD'];
$uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH) ?? '/';
$uri = rawurldecode($uri);

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Accept, Authorization, X-Requested-With');
if ($method === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// --- serve uploaded files ---------------------------------------------------
if (str_starts_with($uri, '/uploads/')) {
    $path = safePath(substr($uri, strlen('/uploads/')));
    if ($path && is_file($path)) {
        header('Content-Type: ' . mimeOf($path));
        header('Cache-Control: no-cache');
        readfile($path);
    } else {
        http_response_code(404);
    }
    exit;
}

// --- API --------------------------------------------------------------------
if (str_starts_with($uri, '/api')) {
    try {
        route($method, substr($uri, strlen('/api')));
    } catch (Throwable $e) {
        json(['error' => $e->getMessage()], 400);
    }
    exit;
}

// dev harness convenience: anything else 404
http_response_code(404);
echo 'Not found';

// ===========================================================================

function route(string $method, string $path): void
{
    $path = '/' . trim($path, '/');

    // folders ---------------------------------------------------------------
    if ($path === '/folders' && $method === 'GET') {
        json(listFolders());
    }
    if ($path === '/folders' && $method === 'POST') {
        $d = body();
        json(createFolder($d['name'] ?? 'folder', $d['parent'] ?? null));
    }
    if (preg_match('#^/folders/(.+)$#', $path, $m)) {
        if ($method === 'PUT') {
            json(renameFolder($m[1], body()['name'] ?? ''));
        }
        if ($method === 'DELETE') {
            removeNode($m[1]);
            noContent();
        }
    }

    // files -----------------------------------------------------------------
    if ($path === '/files' && $method === 'GET') {
        json(listFiles($_GET['folder'] ?? ''));
    }
    if ($path === '/files' && $method === 'POST') {
        json(uploadFile());
    }
    if ($path === '/files/move' && $method === 'POST') {
        $d = body();
        json(moveFile($d['from'] ?? '', $d['to'] ?? ''));
    }
    if ($path === '/files/crop' && $method === 'POST') {
        json(cropFile(body()));
    }
    if (preg_match('#^/files/(.+)$#', $path, $m)) {
        if ($method === 'PUT') {
            json(updateFile($m[1], body()));
        }
        if ($method === 'DELETE') {
            $abs = safePath($m[1]);
            if ($abs && is_file($abs)) {
                setMeta($m[1], null);
                unlink($abs);
            }
            noContent();
        }
    }

    json(['error' => 'Unknown route ' . $method . ' ' . $path], 404);
}

// --- folders ----------------------------------------------------------------

function listFolders(): array
{
    $out = [];
    $walk = function (string $base) use (&$walk, &$out) {
        foreach (scandir($base) ?: [] as $name) {
            if ($name[0] === '.') {
                continue;
            }
            $abs = $base . '/' . $name;
            if (is_dir($abs)) {
                $id = relId($abs);
                $parent = dirname($id);
                $out[] = [
                    'id' => $id,
                    'name' => $name,
                    'parent' => $parent === '.' ? null : $parent,
                ];
                $walk($abs);
            }
        }
    };
    $walk(ROOT);
    return $out;
}

function createFolder(string $name, ?string $parent): array
{
    $name = slug($name);
    $dir = ROOT . '/' . trim(($parent ? $parent . '/' : '') . $name, '/');
    $dir = dedupe($dir, true);
    mkdir($dir, 0775, true);
    $id = relId($dir);
    return ['id' => $id, 'name' => basename($dir), 'parent' => $parent ?: null];
}

function renameFolder(string $id, string $name): array
{
    $abs = safePath($id);
    if (!$abs || !is_dir($abs)) {
        throw new RuntimeException('Folder not found');
    }
    $target = dedupe(dirname($abs) . '/' . slug($name), true);
    rename($abs, $target);
    $newId = relId($target);
    $parent = dirname($newId);
    return ['id' => $newId, 'name' => basename($target), 'parent' => $parent === '.' ? null : $parent];
}

// --- files ------------------------------------------------------------------

function listFiles(string $folder): array
{
    $base = $folder ? safePath($folder) : ROOT;
    if (!$base || !is_dir($base)) {
        return [];
    }
    $meta = readMeta($folder);
    $out = [];
    foreach (scandir($base) ?: [] as $name) {
        if ($name[0] === '.' || !is_file($base . '/' . $name)) {
            continue;
        }
        $out[] = fileItem($folder, $name, $meta[$name] ?? []);
    }
    return $out;
}

function uploadFile(): array
{
    $folder = $_POST['folder'] ?? '';
    if (!isset($_FILES['file'])) {
        throw new RuntimeException('No file');
    }
    $base = $folder ? safePath($folder) : ROOT;
    if (!$base || !is_dir($base)) {
        throw new RuntimeException('Bad folder');
    }
    $orig = $_FILES['file']['name'];
    $ext = strtolower(pathinfo($orig, PATHINFO_EXTENSION));
    $name = slug(pathinfo($orig, PATHINFO_FILENAME)) . ($ext ? '.' . $ext : '');
    $dest = dedupe($base . '/' . $name, false);
    move_uploaded_file($_FILES['file']['tmp_name'], $dest)
        || rename($_FILES['file']['tmp_name'], $dest);
    return fileItem($folder, basename($dest), []);
}

function updateFile(string $id, array $patch): array
{
    $abs = safePath($id);
    if (!$abs || !is_file($abs)) {
        throw new RuntimeException('File not found');
    }
    $folder = dirname($id) === '.' ? '' : dirname($id);
    $name = basename($abs);

    if (!empty($patch['name'])) {
        $ext = pathinfo($abs, PATHINFO_EXTENSION);
        $newName = slug(pathinfo($patch['name'], PATHINFO_FILENAME)) . ($ext ? '.' . $ext : '');
        $dest = dedupe(dirname($abs) . '/' . $newName, false);
        $old = $name;
        rename($abs, $dest);
        $name = basename($dest);
        // carry metadata across the rename
        $m = readMeta($folder);
        if (isset($m[$old])) {
            $m[$name] = $m[$old];
            unset($m[$old]);
            writeMeta($folder, $m);
        }
    }

    if (array_key_exists('meta', $patch)) {
        setMeta(($folder ? $folder . '/' : '') . $name, $patch['meta']);
    }

    return fileItem($folder, $name, readMeta($folder)[$name] ?? []);
}

function moveFile(string $from, string $to): array
{
    $abs = safePath($from);
    if (!$abs || !is_file($abs)) {
        throw new RuntimeException('File not found');
    }
    $destDir = $to ? safePath($to) : ROOT;
    if (!$destDir || !is_dir($destDir)) {
        throw new RuntimeException('Bad target folder');
    }
    $name = basename($abs);
    $dest = dedupe($destDir . '/' . $name, false);
    // move metadata too
    $fromFolder = dirname($from) === '.' ? '' : dirname($from);
    $m = readMeta($fromFolder);
    $carried = $m[$name] ?? null;
    if ($carried !== null) {
        unset($m[$name]);
        writeMeta($fromFolder, $m);
    }
    rename($abs, $dest);
    if ($carried !== null) {
        setMeta(($to ? $to . '/' : '') . basename($dest), $carried);
    }
    return fileItem($to, basename($dest), $carried ?? []);
}

function cropFile(array $d): array
{
    $abs = safePath($d['source'] ?? '');
    if (!$abs || !is_file($abs)) {
        throw new RuntimeException('Source not found');
    }
    $crop = $d['crop'] ?? [];
    [$x, $y, $w, $h] = [
        (int) ($crop['x'] ?? 0),
        (int) ($crop['y'] ?? 0),
        (int) ($crop['width'] ?? 0),
        (int) ($crop['height'] ?? 0),
    ];
    if ($w <= 0 || $h <= 0) {
        throw new RuntimeException('Invalid crop');
    }

    $srcExt = strtolower(pathinfo($abs, PATHINFO_EXTENSION));
    $img = loadImage($abs, $srcExt);
    $cropped = imagecrop($img, ['x' => $x, 'y' => $y, 'width' => $w, 'height' => $h]);
    if ($cropped === false) {
        throw new RuntimeException('Crop failed');
    }

    $maxW = (int) ($d['maxWidth'] ?? 0);
    if ($maxW > 0 && imagesx($cropped) > $maxW) {
        $scaled = imagescale($cropped, $maxW);
        if ($scaled !== false) {
            $cropped = $scaled;
        }
    }

    $outExt = in_array($d['format'] ?? '', ['jpeg', 'png', 'webp'], true)
        ? ($d['format'] === 'jpeg' ? 'jpg' : $d['format'])
        : $srcExt;
    $quality = isset($d['quality']) ? (int) round(((float) $d['quality']) * 100) : 82;

    $folder = dirname($d['source']) === '.' ? '' : dirname($d['source']);
    $stem = pathinfo($abs, PATHINFO_FILENAME);
    $dest = dedupe(dirname($abs) . "/{$stem}-{$w}x{$h}.{$outExt}", false);
    saveImage($cropped, $dest, $outExt, $quality);

    return fileItem($folder, basename($dest), []);
}

// --- helpers ----------------------------------------------------------------

function fileItem(string $folder, string $name, array $meta): array
{
    $id = trim(($folder ? $folder . '/' : '') . $name, '/');
    $abs = ROOT . '/' . $id;
    return [
        'id' => $id,
        'name' => $name,
        'url' => '/uploads/' . implode('/', array_map('rawurlencode', explode('/', $id))),
        'folder' => $folder ?: null,
        'thumbnail' => isImageName($name) ? '/uploads/' . $id : placeholderThumb(),
        'size' => is_file($abs) ? filesize($abs) : 0,
        'mtime' => is_file($abs) ? filemtime($abs) : 0,
        'meta' => [
            'alt' => $meta['alt'] ?? '',
            'title' => $meta['title'] ?? '',
        ],
    ];
}

function loadImage(string $path, string $ext): GdImage
{
    $img = match ($ext) {
        'jpg', 'jpeg' => imagecreatefromjpeg($path),
        'png' => imagecreatefrompng($path),
        'gif' => imagecreatefromgif($path),
        'webp' => imagecreatefromwebp($path),
        default => throw new RuntimeException('Unsupported image format: ' . $ext),
    };
    if ($img === false) {
        throw new RuntimeException('Could not read image');
    }
    return $img;
}

function saveImage(GdImage $img, string $dest, string $ext, int $quality): void
{
    switch ($ext) {
        case 'jpg':
        case 'jpeg':
            imagejpeg($img, $dest, $quality);
            break;
        case 'png':
            imagealphablending($img, false);
            imagesavealpha($img, true);
            imagepng($img, $dest);
            break;
        case 'webp':
            imagewebp($img, $dest, $quality);
            break;
        case 'gif':
            imagegif($img, $dest);
            break;
        default:
            throw new RuntimeException('Unsupported output format: ' . $ext);
    }
}

function removeNode(string $id): void
{
    $abs = safePath($id);
    if (!$abs) {
        return;
    }
    if (is_file($abs)) {
        unlink($abs);
    } elseif (is_dir($abs)) {
        $it = new RecursiveIteratorIterator(
            new RecursiveDirectoryIterator($abs, FilesystemIterator::SKIP_DOTS),
            RecursiveIteratorIterator::CHILD_FIRST,
        );
        foreach ($it as $f) {
            $f->isDir() ? rmdir($f->getPathname()) : unlink($f->getPathname());
        }
        rmdir($abs);
    }
}

// --- metadata sidecar -------------------------------------------------------

function metaPath(string $folder): string
{
    $base = $folder ? safePath($folder) : ROOT;
    return ($base ?: ROOT) . '/.meta.json';
}

function readMeta(string $folder): array
{
    $p = metaPath($folder);
    return is_file($p) ? (json_decode((string) file_get_contents($p), true) ?: []) : [];
}

function writeMeta(string $folder, array $meta): void
{
    $p = metaPath($folder);
    if (!$meta) {
        if (is_file($p)) {
            unlink($p);
        }
        return;
    }
    file_put_contents($p, json_encode($meta, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));
}

function setMeta(string $fileId, ?array $meta): void
{
    $folder = dirname($fileId) === '.' ? '' : dirname($fileId);
    $name = basename($fileId);
    $all = readMeta($folder);
    if ($meta === null) {
        unset($all[$name]);
    } else {
        $all[$name] = array_filter([
            'alt' => $meta['alt'] ?? '',
            'title' => $meta['title'] ?? '',
        ], fn ($v) => $v !== '');
        if (!$all[$name]) {
            unset($all[$name]);
        }
    }
    writeMeta($folder, $all);
}

// --- filesystem utils -------------------------------------------------------

function relId(string $abs): string
{
    return trim(str_replace(ROOT, '', $abs), '/');
}

/** Resolve an id to an absolute path, refusing anything outside ROOT. */
function safePath(string $id): ?string
{
    $id = str_replace('\\', '/', $id);
    $abs = ROOT . '/' . trim($id, '/');
    $real = realpath($abs);
    if ($real !== false) {
        // existing target: compare resolved paths (handles symlinked storage roots)
        $rootReal = realpath(ROOT);
        return str_starts_with($real, (string) $rootReal . '/') || $real === $rootReal
            ? $abs
            : null;
    }
    // not-yet-existing target (dedupe destination, new folder): collapse `..`
    // lexically and compare against the lexical root.
    $lex = lexicalResolve($abs);
    $rootLex = lexicalResolve(ROOT);
    return str_starts_with($lex, $rootLex . '/') || $lex === $rootLex ? $abs : null;
}

/** Collapse `.` and `..` segments without touching the filesystem. */
function lexicalResolve(string $path): string
{
    $isAbs = str_starts_with($path, '/');
    $out = [];
    foreach (explode('/', $path) as $seg) {
        if ($seg === '' || $seg === '.') {
            continue;
        }
        if ($seg === '..') {
            array_pop($out);
            continue;
        }
        $out[] = $seg;
    }
    return ($isAbs ? '/' : '') . implode('/', $out);
}

function dedupe(string $path, bool $isDir): string
{
    if (!file_exists($path)) {
        return $path;
    }
    $dir = dirname($path);
    $name = $isDir ? basename($path) : pathinfo($path, PATHINFO_FILENAME);
    $ext = $isDir ? '' : '.' . pathinfo($path, PATHINFO_EXTENSION);
    $i = 1;
    do {
        $candidate = "$dir/$name-$i$ext";
        $i++;
    } while (file_exists($candidate));
    return $candidate;
}

function slug(string $s): string
{
    $s = mb_strtolower(trim($s));
    $s = preg_replace('/[^a-z0-9]+/u', '-', $s) ?? $s;
    return trim($s, '-') ?: 'file';
}

function isImageName(string $name): bool
{
    return in_array(
        strtolower(pathinfo($name, PATHINFO_EXTENSION)),
        ['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif', 'svg', 'bmp', 'ico'],
        true,
    );
}

function mimeOf(string $path): string
{
    return match (strtolower(pathinfo($path, PATHINFO_EXTENSION))) {
        'jpg', 'jpeg' => 'image/jpeg',
        'png' => 'image/png',
        'gif' => 'image/gif',
        'webp' => 'image/webp',
        'svg' => 'image/svg+xml',
        'avif' => 'image/avif',
        'pdf' => 'application/pdf',
        default => 'application/octet-stream',
    };
}

function placeholderThumb(): string
{
    return 'data:image/svg+xml,' . rawurlencode(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="gray" stroke-width="1.5"><path d="M14 3v4a1 1 0 0 0 1 1h4"/><path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2Z"/></svg>',
    );
}

function body(): array
{
    $raw = file_get_contents('php://input') ?: '';
    return $raw ? (json_decode($raw, true) ?: []) : [];
}

function json(array $data, int $status = 200): void
{
    http_response_code($status);
    header('Content-Type: application/json');
    echo json_encode($data, JSON_UNESCAPED_SLASHES);
    exit;
}

function noContent(): void
{
    http_response_code(204);
    exit;
}
