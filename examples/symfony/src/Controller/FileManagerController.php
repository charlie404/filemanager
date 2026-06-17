<?php

namespace App\Controller;

use App\Service\FileManagerStorage;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\DependencyInjection\Attribute\Autowire;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;

/**
 * Backend REST pour l'élément personnalisé `<file-manager>` (@charlie404/filemanager).
 *
 * Implémente le contrat complet de la librairie sous un préfixe configurable
 * (ici `/admin/file-manager`). Les réponses JSON ont une forme strictement
 * identique à l'implémentation de référence (`server/router.php`) : le contrôleur
 * reste mince, toute la logique vit dans {@see FileManagerStorage}.
 *
 * Identifiants : un `id` est un chemin relatif à la racine de stockage et peut
 * contenir des « / ». Les routes paramétrées doivent donc autoriser les slashs
 * via `requirements: ['id' => '.+']`.
 *
 * Le recadrage est réalisé côté serveur avec l'extension GD (voir le service).
 */
#[Route('/admin/file-manager')]
class FileManagerController extends AbstractController
{
  /**
   * @param FileManagerStorage $storage Logique « système de fichiers » (slug, dédup, méta, crop).
   *
   * La racine de stockage et l'URL publique sont câblées via les paramètres
   * liés du conteneur (voir config/services.yaml). Par convention :
   *   racine    : %kernel.project_dir%/public/uploads/media
   *   URL base  : /uploads/media
   */
  public function __construct(
    private FileManagerStorage $storage,
  ) {}

  /**
   * Point d'entrée de l'API : sert d'`endpoint` à l'élément `<file-manager>`.
   * Toutes les routes ci-dessous sont relatives à ce préfixe.
   */
  #[Route('', name: 'admin.fileManager.index', methods: ['GET'])]
  public function index(): JsonResponse
  {
    return $this->json_ok(['success' => 'API chargée']);
  }

  // --- Dossiers --------------------------------------------------------------

  /** GET /folders -> [{id, name, parent}] */
  #[Route('/folders', name: 'admin.fileManager.folders', methods: ['GET'])]
  public function folders(): JsonResponse
  {
    return $this->json_ok($this->storage->listFolders());
  }

  /** POST /folders {name, parent} -> {id, name, parent} */
  #[Route('/folders', name: 'admin.fileManager.folders.post', methods: ['POST'])]
  public function createFolder(Request $request): JsonResponse
  {
    $data = $this->json_body($request);

    return $this->json_ok(
      $this->storage->createFolder($data['name'] ?? 'folder', $data['parent'] ?? null),
    );
  }

  /** PUT /folders/{id} {name} -> {id, name, parent} */
  #[Route('/folders/{id}', name: 'admin.fileManager.folders.put', requirements: ['id' => '.+'], methods: ['PUT'])]
  public function renameFolder(Request $request, string $id): JsonResponse
  {
    $data = $this->json_body($request);

    return $this->json_ok($this->storage->renameFolder($id, $data['name'] ?? ''));
  }

  /** DELETE /folders/{id} -> 204 */
  #[Route('/folders/{id}', name: 'admin.fileManager.folders.delete', requirements: ['id' => '.+'], methods: ['DELETE'])]
  public function deleteFolder(string $id): Response
  {
    $this->storage->removeNode($id);

    return new Response('', Response::HTTP_NO_CONTENT);
  }

  // --- Fichiers --------------------------------------------------------------

  /** GET /files?folder=ID -> [FileItem] */
  #[Route('/files', name: 'admin.fileManager.files', methods: ['GET'])]
  public function files(Request $request): JsonResponse
  {
    $folder = $request->query->get('folder') ?: null;

    return $this->json_ok($this->storage->listFiles($folder));
  }

  /** POST /files (multipart: file, folder) -> FileItem */
  #[Route('/files', name: 'admin.fileManager.files.post', methods: ['POST'])]
  public function uploadFile(Request $request): JsonResponse
  {
    $upload = $request->files->get('file');
    if ($upload === null) {
      return $this->json_ok(['error' => 'No file'], Response::HTTP_BAD_REQUEST);
    }
    $folder = $request->request->get('folder') ?: null;

    return $this->json_ok($this->storage->storeUpload($upload, $folder));
  }

  /** POST /files/move {from, to} -> FileItem */
  #[Route('/files/move', name: 'admin.fileManager.files.move', methods: ['POST'])]
  public function moveFile(Request $request): JsonResponse
  {
    $data = $this->json_body($request);

    return $this->json_ok(
      $this->storage->moveFile($data['from'] ?? '', $data['to'] ?? null),
    );
  }

  /** POST /files/crop {source, crop, format?, quality?, maxWidth?} -> FileItem (dérivé GD) */
  #[Route('/files/crop', name: 'admin.fileManager.files.crop', methods: ['POST'])]
  public function cropFile(Request $request): JsonResponse
  {
    return $this->json_ok($this->storage->cropFile($this->json_body($request)));
  }

  /** PUT /files/{id} {name?, meta?} -> FileItem (renommage et/ou métadonnées) */
  #[Route('/files/{id}', name: 'admin.fileManager.files.put', requirements: ['id' => '.+'], methods: ['PUT'])]
  public function updateFile(Request $request, string $id): JsonResponse
  {
    return $this->json_ok($this->storage->updateFile($id, $this->json_body($request)));
  }

  /** DELETE /files/{id} -> 204 */
  #[Route('/files/{id}', name: 'admin.fileManager.files.delete', requirements: ['id' => '.+'], methods: ['DELETE'])]
  public function deleteFile(string $id): Response
  {
    $this->storage->removeNode($id);

    return new Response('', Response::HTTP_NO_CONTENT);
  }

  // --- Utilitaires -----------------------------------------------------------

  /**
   * Réponse JSON avec `JSON_UNESCAPED_SLASHES`, afin de produire des URLs
   * propres (`/uploads/media/…` et non `\/uploads\/…`) strictement identiques
   * à l'implémentation de référence (server/router.php).
   *
   * @param mixed $data
   */
  private function json_ok($data, int $status = Response::HTTP_OK): JsonResponse
  {
    $response = new JsonResponse($data, $status);
    $response->setEncodingOptions($response->getEncodingOptions() | JSON_UNESCAPED_SLASHES);

    return $response;
  }

  /**
   * Décode le corps JSON d'une requête (PUT/POST applicatifs).
   *
   * @return array<string, mixed>
   */
  private function json_body(Request $request): array
  {
    $raw = $request->getContent();
    if ($raw === '') {
      return [];
    }
    $data = json_decode($raw, true);

    return \is_array($data) ? $data : [];
  }
}
