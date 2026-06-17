<?php

namespace App\Service;

use Symfony\Component\Filesystem\Filesystem;
use Symfony\Component\String\Slugger\SluggerInterface;

/**
 * Service de stockage pour le gestionnaire de fichiers @charlie404/filemanager.
 *
 * Regroupe toute la logique « système de fichiers » afin de garder le contrôleur
 * mince : slugification, déduplication, sécurisation des chemins (anti path
 * traversal), lecture/écriture des métadonnées via un sidecar `.meta.json` par
 * dossier, et recadrage d'image côté serveur avec l'extension GD.
 *
 * Aucune base de données n'est nécessaire : tout vit dans le système de fichiers
 * sous la racine de stockage (`public/uploads/media` par convention).
 */
class FileManagerStorage
{
  /** Extensions considérées comme des images (aperçu direct). */
  private const IMAGE_EXTENSIONS = [
    'jpg', 'jpeg', 'png', 'gif', 'webp', 'avif', 'svg', 'bmp', 'ico',
  ];

  /** Extensions d'images pixellisées que GD sait charger pour le recadrage. */
  private const GD_READABLE = ['jpg', 'jpeg', 'png', 'gif', 'webp'];

  private Filesystem $filesystem;

  /** Chemin absolu et canonique de la racine de stockage. */
  private string $root;

  /**
   * @param SluggerInterface $slugger Service de slugification des noms.
   * @param string           $root    Racine de stockage (ex. %kernel.project_dir%/public/uploads/media).
   * @param string           $baseUrl Préfixe d'URL publique de la racine (ex. /uploads/media).
   */
  public function __construct(
    private SluggerInterface $slugger,
    string $root,
    private string $baseUrl = '/uploads/media',
  ) {
    $this->filesystem = new Filesystem();
    if (!$this->filesystem->exists($root)) {
      $this->filesystem->mkdir($root, 0775);
    }
    // realpath() ne fonctionne que sur un chemin existant : le dossier est créé juste avant.
    $this->root = rtrim(str_replace('\\', '/', realpath($root)), '/');
    $this->baseUrl = '/' . trim($baseUrl, '/');
  }

  // --- Dossiers --------------------------------------------------------------

  /**
   * Liste récursivement tous les dossiers sous la racine.
   *
   * @return array<int, array{id: string, name: string, parent: string|null}>
   */
  public function listFolders(): array
  {
    $out = [];
    $walk = function (string $base) use (&$walk, &$out): void {
      foreach (scandir($base) ?: [] as $name) {
        if ($name[0] === '.') {
          continue;
        }
        $abs = $base . '/' . $name;
        if (is_dir($abs)) {
          $id = $this->relId($abs);
          $parent = \dirname($id);
          $out[] = [
            'id' => $id,
            'name' => $name,
            'parent' => $parent === '.' ? null : $parent,
          ];
          $walk($abs);
        }
      }
    };
    $walk($this->root);

    return $out;
  }

  /**
   * Crée un dossier (déduplique le nom au besoin).
   *
   * @return array{id: string, name: string, parent: string|null}
   */
  public function createFolder(string $name, ?string $parent): array
  {
    $name = $this->slug($name);
    $dir = $this->root . '/' . trim(($parent ? $parent . '/' : '') . $name, '/');
    $dir = $this->dedupe($dir, true);
    $this->filesystem->mkdir($dir, 0775);
    $id = $this->relId($dir);

    return ['id' => $id, 'name' => basename($dir), 'parent' => $parent ?: null];
  }

  /**
   * Renomme un dossier (déduplique au besoin).
   *
   * @return array{id: string, name: string, parent: string|null}
   */
  public function renameFolder(string $id, string $name): array
  {
    $abs = $this->safePath($id);
    if ($abs === null || !is_dir($abs)) {
      throw new \RuntimeException('Folder not found');
    }
    $target = $this->dedupe(\dirname($abs) . '/' . $this->slug($name), true);
    $this->filesystem->rename($abs, $target);
    $newId = $this->relId($target);
    $parent = \dirname($newId);

    return ['id' => $newId, 'name' => basename($target), 'parent' => $parent === '.' ? null : $parent];
  }

  /** Supprime un dossier (récursif) ou un fichier. */
  public function removeNode(string $id): void
  {
    $abs = $this->safePath($id);
    if ($abs === null) {
      return;
    }
    if (is_file($abs)) {
      $this->setMeta($id, null);
      $this->filesystem->remove($abs);
    } elseif (is_dir($abs)) {
      $this->filesystem->remove($abs);
    }
  }

  // --- Fichiers --------------------------------------------------------------

  /**
   * Liste les fichiers d'un dossier (profondeur 0), métadonnées incluses.
   *
   * @return array<int, array<string, mixed>>
   */
  public function listFiles(?string $folder): array
  {
    $base = $folder ? $this->safePath($folder) : $this->root;
    if ($base === null || !is_dir($base)) {
      return [];
    }
    $meta = $this->readMeta($folder);
    $out = [];
    foreach (scandir($base) ?: [] as $name) {
      if ($name[0] === '.' || !is_file($base . '/' . $name)) {
        continue;
      }
      $out[] = $this->fileItem($folder, $name, $meta[$name] ?? []);
    }

    return $out;
  }

  /**
   * Déplace un fichier téléversé dans le dossier cible (slug + dédup).
   *
   * @param \Symfony\Component\HttpFoundation\File\UploadedFile $upload
   *
   * @return array<string, mixed>
   */
  public function storeUpload($upload, ?string $folder): array
  {
    $base = $folder ? $this->safePath($folder) : $this->root;
    if ($base === null || !is_dir($base)) {
      throw new \RuntimeException('Bad folder');
    }
    $info = pathinfo($upload->getClientOriginalName());
    $ext = strtolower($info['extension'] ?? '');
    $name = $this->slug($info['filename'] ?? 'file') . ($ext ? '.' . $ext : '');
    $dest = $this->dedupe($base . '/' . $name, false);
    $upload->move($base, basename($dest));

    return $this->fileItem($folder, basename($dest), []);
  }

  /**
   * Renomme un fichier et/ou met à jour ses métadonnées.
   *
   * @param array{name?: string, meta?: array{alt?: string, title?: string}} $patch
   *
   * @return array<string, mixed>
   */
  public function updateFile(string $id, array $patch): array
  {
    $abs = $this->safePath($id);
    if ($abs === null || !is_file($abs)) {
      throw new \RuntimeException('File not found');
    }
    $folder = \dirname($id) === '.' ? null : \dirname($id);
    $name = basename($abs);

    if (!empty($patch['name'])) {
      $ext = pathinfo($abs, PATHINFO_EXTENSION);
      $newName = $this->slug(pathinfo($patch['name'], PATHINFO_FILENAME)) . ($ext ? '.' . $ext : '');
      $dest = $this->dedupe(\dirname($abs) . '/' . $newName, false);
      $old = $name;
      $this->filesystem->rename($abs, $dest);
      $name = basename($dest);
      // On reporte les métadonnées au travers du renommage.
      $m = $this->readMeta($folder);
      if (isset($m[$old])) {
        $m[$name] = $m[$old];
        unset($m[$old]);
        $this->writeMeta($folder, $m);
      }
    }

    if (array_key_exists('meta', $patch)) {
      $this->setMeta(($folder ? $folder . '/' : '') . $name, $patch['meta']);
    }

    return $this->fileItem($folder, $name, $this->readMeta($folder)[$name] ?? []);
  }

  /**
   * Déplace un fichier vers un autre dossier (déplace aussi ses métadonnées).
   *
   * @return array<string, mixed>
   */
  public function moveFile(string $from, ?string $to): array
  {
    $abs = $this->safePath($from);
    if ($abs === null || !is_file($abs)) {
      throw new \RuntimeException('File not found');
    }
    $destDir = $to ? $this->safePath($to) : $this->root;
    if ($destDir === null || !is_dir($destDir)) {
      throw new \RuntimeException('Bad target folder');
    }
    $name = basename($abs);
    $dest = $this->dedupe($destDir . '/' . $name, false);

    // Métadonnées : on les retire de la source pour les reposer sur la cible.
    $fromFolder = \dirname($from) === '.' ? null : \dirname($from);
    $m = $this->readMeta($fromFolder);
    $carried = $m[$name] ?? null;
    if ($carried !== null) {
      unset($m[$name]);
      $this->writeMeta($fromFolder, $m);
    }
    $this->filesystem->rename($abs, $dest);
    if ($carried !== null) {
      $this->setMeta(($to ? $to . '/' : '') . basename($dest), $carried);
    }

    return $this->fileItem($to, basename($dest), $carried ?? []);
  }

  /**
   * Recadre une image côté serveur (GD), de façon non destructive : un NOUVEAU
   * fichier `<stem>-<w>x<h>.<ext>` est écrit, l'original est conservé.
   *
   * @param array{source?: string, crop?: array{x?: int, y?: int, width?: int, height?: int}, format?: string, quality?: float, maxWidth?: int} $params
   *
   * @return array<string, mixed>
   */
  public function cropFile(array $params): array
  {
    $abs = $this->safePath($params['source'] ?? '');
    if ($abs === null || !is_file($abs)) {
      throw new \RuntimeException('Source not found');
    }
    $crop = $params['crop'] ?? [];
    $x = (int) ($crop['x'] ?? 0);
    $y = (int) ($crop['y'] ?? 0);
    $w = (int) ($crop['width'] ?? 0);
    $h = (int) ($crop['height'] ?? 0);
    if ($w <= 0 || $h <= 0) {
      throw new \RuntimeException('Invalid crop');
    }

    $srcExt = strtolower(pathinfo($abs, PATHINFO_EXTENSION));
    $img = $this->loadImage($abs, $srcExt);

    try {
      $cropped = imagecrop($img, ['x' => $x, 'y' => $y, 'width' => $w, 'height' => $h]);
      if ($cropped === false) {
        throw new \RuntimeException('Crop failed');
      }

      $maxW = (int) ($params['maxWidth'] ?? 0);
      if ($maxW > 0 && imagesx($cropped) > $maxW) {
        $scaled = imagescale($cropped, $maxW);
        if ($scaled !== false) {
          imagedestroy($cropped);
          $cropped = $scaled;
        }
      }

      $format = $params['format'] ?? '';
      $outExt = \in_array($format, ['jpeg', 'png', 'webp'], true)
        ? ($format === 'jpeg' ? 'jpg' : $format)
        : $srcExt;
      // L'API exprime la qualité en 0..1 ; GD attend 0..100.
      $quality = isset($params['quality']) ? (int) round(((float) $params['quality']) * 100) : 82;

      $folder = \dirname($params['source']) === '.' ? null : \dirname($params['source']);
      $stem = pathinfo($abs, PATHINFO_FILENAME);
      $dest = $this->dedupe(\dirname($abs) . "/{$stem}-{$w}x{$h}.{$outExt}", false);
      $this->saveImage($cropped, $dest, $outExt, $quality);
    } finally {
      if (isset($cropped) && $cropped instanceof \GdImage) {
        imagedestroy($cropped);
      }
      imagedestroy($img);
    }

    return $this->fileItem($folder, basename($dest), []);
  }

  // --- Construction du FileItem ---------------------------------------------

  /**
   * Construit l'objet FileItem retourné par l'API.
   *
   * @param array{alt?: string, title?: string} $meta
   *
   * @return array<string, mixed>
   */
  private function fileItem(?string $folder, string $name, array $meta): array
  {
    $id = trim(($folder ? $folder . '/' : '') . $name, '/');
    $abs = $this->root . '/' . $id;
    $url = $this->baseUrl . '/' . implode('/', array_map('rawurlencode', explode('/', $id)));

    return [
      'id' => $id,
      'name' => $name,
      'url' => $url,
      'folder' => $folder ?: null,
      'thumbnail' => $this->isImageName($name) ? $url : $this->placeholderThumb(),
      'size' => is_file($abs) ? filesize($abs) : 0,
      'mtime' => is_file($abs) ? filemtime($abs) : 0,
      'meta' => [
        'alt' => $meta['alt'] ?? '',
        'title' => $meta['title'] ?? '',
      ],
    ];
  }

  // --- GD --------------------------------------------------------------------

  /** Charge une image via GD selon son extension. */
  private function loadImage(string $path, string $ext): \GdImage
  {
    if (!\in_array($ext, self::GD_READABLE, true)) {
      throw new \RuntimeException('Unsupported image format: ' . $ext);
    }
    $img = match ($ext) {
      'jpg', 'jpeg' => imagecreatefromjpeg($path),
      'png' => imagecreatefrompng($path),
      'gif' => imagecreatefromgif($path),
      'webp' => imagecreatefromwebp($path),
    };
    if ($img === false) {
      throw new \RuntimeException('Could not read image');
    }

    return $img;
  }

  /** Écrit l'image GD dans le format demandé (préserve l'alpha pour PNG). */
  private function saveImage(\GdImage $img, string $dest, string $ext, int $quality): void
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
        throw new \RuntimeException('Unsupported output format: ' . $ext);
    }
  }

  // --- Sidecar .meta.json ----------------------------------------------------

  /** Chemin absolu du sidecar `.meta.json` d'un dossier. */
  private function metaPath(?string $folder): string
  {
    $base = $folder ? $this->safePath($folder) : $this->root;

    return ($base ?: $this->root) . '/.meta.json';
  }

  /**
   * Lit le sidecar d'un dossier : map `filename => {alt, title}`.
   *
   * @return array<string, array{alt?: string, title?: string}>
   */
  public function readMeta(?string $folder): array
  {
    $p = $this->metaPath($folder);

    return is_file($p) ? (json_decode((string) file_get_contents($p), true) ?: []) : [];
  }

  /**
   * Écrit (ou supprime, si vide) le sidecar d'un dossier.
   *
   * @param array<string, array{alt?: string, title?: string}> $meta
   */
  private function writeMeta(?string $folder, array $meta): void
  {
    $p = $this->metaPath($folder);
    if (!$meta) {
      if (is_file($p)) {
        $this->filesystem->remove($p);
      }

      return;
    }
    file_put_contents($p, json_encode($meta, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));
  }

  /**
   * Met à jour (ou supprime si `null`) l'entrée d'un fichier dans son sidecar.
   *
   * @param array{alt?: string, title?: string}|null $meta
   */
  private function setMeta(string $fileId, ?array $meta): void
  {
    $folder = \dirname($fileId) === '.' ? null : \dirname($fileId);
    $name = basename($fileId);
    $all = $this->readMeta($folder);
    if ($meta === null) {
      unset($all[$name]);
    } else {
      $entry = array_filter([
        'alt' => $meta['alt'] ?? '',
        'title' => $meta['title'] ?? '',
      ], fn ($v) => $v !== '');
      if ($entry) {
        $all[$name] = $entry;
      } else {
        unset($all[$name]);
      }
    }
    $this->writeMeta($folder, $all);
  }

  // --- Utilitaires système de fichiers ---------------------------------------

  /** Convertit un chemin absolu en identifiant relatif à la racine. */
  private function relId(string $abs): string
  {
    return trim(str_replace($this->root, '', str_replace('\\', '/', $abs)), '/');
  }

  /**
   * Résout un identifiant en chemin absolu, en refusant tout ce qui sortirait
   * de la racine (protection contre le path traversal). Retourne `null` si le
   * chemin échappe à la racine.
   */
  private function safePath(string $id): ?string
  {
    $id = str_replace('\\', '/', $id);
    $abs = $this->root . '/' . trim($id, '/');
    $real = realpath($abs);
    if ($real === false) {
      // Cible pas encore créée (ex. destination de dédup) : on valide le chemin lexical.
      $real = $abs;
    }
    $real = str_replace('\\', '/', $real);

    return str_starts_with($real, $this->root) ? $abs : null;
  }

  /** Renvoie un chemin libre en suffixant `-1`, `-2`… en cas de collision. */
  private function dedupe(string $path, bool $isDir): string
  {
    if (!file_exists($path)) {
      return $path;
    }
    $dir = \dirname($path);
    $name = $isDir ? basename($path) : pathinfo($path, PATHINFO_FILENAME);
    $ext = $isDir ? '' : '.' . pathinfo($path, PATHINFO_EXTENSION);
    $i = 1;
    do {
      $candidate = "$dir/$name-$i$ext";
      ++$i;
    } while (file_exists($candidate));

    return $candidate;
  }

  /** Slugifie : minuscules, caractères non alphanumériques -> `-`. */
  private function slug(string $s): string
  {
    $slug = strtolower((string) $this->slugger->slug($s));

    return $slug !== '' ? $slug : 'file';
  }

  /** Vrai si l'extension correspond à une image (aperçu direct possible). */
  private function isImageName(string $name): bool
  {
    return \in_array(
      strtolower(pathinfo($name, PATHINFO_EXTENSION)),
      self::IMAGE_EXTENSIONS,
      true,
    );
  }

  /** Vignette « document » pour les fichiers non-image (data: SVG). */
  private function placeholderThumb(): string
  {
    return 'data:image/svg+xml,' . rawurlencode(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="gray" stroke-width="1.5"><path d="M14 3v4a1 1 0 0 0 1 1h4"/><path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2Z"/></svg>',
    );
  }
}
