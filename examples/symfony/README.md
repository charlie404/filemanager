# Backend Symfony — `@charlie404/filemanager`

Backend de référence, prêt à copier, qui implémente le contrat REST complet de
l'élément `<file-manager>`. Aucune base de données : les fichiers vivent dans le
système de fichiers et les métadonnées dans un sidecar `.meta.json` par dossier.

## Pré-requis

- PHP **8.2+**
- L'extension **GD** (`ext-gd`) — utilisée pour le recadrage côté serveur
  (`imagecrop`, `imagescale`, `imagejpeg/png/webp`). Vérifiez avec :

  ```bash
  php -m | grep -i gd
  ```

- `symfony/framework-bundle`, `symfony/http-foundation`, `symfony/filesystem`,
  `symfony/string` (slugger). En projet Symfony standard, tout est déjà présent ;
  sinon :

  ```bash
  composer require symfony/filesystem symfony/string
  ```

## Où vont les fichiers

Copiez dans votre projet, en conservant l'arborescence :

| Fichier de l'exemple                          | Destination dans le projet                    |
| --------------------------------------------- | --------------------------------------------- |
| `src/Controller/FileManagerController.php`    | `src/Controller/FileManagerController.php`     |
| `src/Service/FileManagerStorage.php`          | `src/Service/FileManagerStorage.php`           |
| `assets/filemanager.js`                       | `assets/filemanager.js`                        |
| `templates/_filemanager.html.twig`            | `templates/_filemanager.html.twig`             |
| `config/services.yaml` (extrait)             | à fusionner dans votre `config/services.yaml`  |

La racine de stockage est `public/uploads/media` (créée automatiquement au
premier appel). Servez-la statiquement : l'URL publique d'un média est
`/uploads/media/<id>`.

## Câblage du service

Le contrôleur et le service sont découverts par l'autowiring. Il reste à
fournir les deux arguments scalaires du service de stockage — voir
`config/services.yaml` :

```yaml
services:
  App\Service\FileManagerStorage:
    arguments:
      $root: '%kernel.project_dir%/public/uploads/media'
      $baseUrl: '/uploads/media'
```

Changez `$root`/`$baseUrl` pour stocker ailleurs ; ils doivent rester cohérents
(le disque et l'URL publique pointent vers le même endroit).

## Préfixe de route

Toutes les routes sont sous le préfixe `#[Route('/admin/file-manager')]`
(défini en tête du contrôleur). C'est l'`endpoint` que consomme l'élément.
Modifiez ce seul attribut pour le déplacer (et reportez la même valeur dans
`assets/filemanager.js` et l'attribut `endpoint=""` du template).

Le contrat REST exposé :

```
GET    /admin/file-manager/folders
POST   /admin/file-manager/folders            {name, parent}
PUT    /admin/file-manager/folders/{id}        {name}
DELETE /admin/file-manager/folders/{id}
GET    /admin/file-manager/files?folder=ID
POST   /admin/file-manager/files               (multipart: file, folder)
PUT    /admin/file-manager/files/{id}          {name?, meta?}
POST   /admin/file-manager/files/move          {from, to}
POST   /admin/file-manager/files/crop          {source, crop, format?, quality?, maxWidth?}
DELETE /admin/file-manager/files/{id}
```

> Les `{id}` sont des chemins relatifs à la racine et peuvent contenir des « / » :
> les routes utilisent `requirements: ['id' => '.+']`.

## Front : installer et brancher la librairie

```bash
npm i @charlie404/filemanager
```

Importez le point d'entrée fourni depuis votre bundle principal (`assets/app.js`) :

```js
import './filemanager.js'
```

`assets/filemanager.js` :

1. `FileManager.register('file-manager', { endpoint: '/admin/file-manager' })`
   — enregistre l'élément et fixe l'endpoint (doit correspondre au préfixe de route) ;
2. `bindFileManagers()` — câble les champs `data-filemanager` /
   `data-filemanager-multiple` de la page (à rappeler après toute injection
   HTML dynamique : Turbo, modales Ajax…).

> AssetMapper plutôt que Webpack Encore ? Faites
> `php bin/console importmap:require @charlie404/filemanager`, puis le même
> `import './filemanager.js'`.

Placez ensuite le partial une fois par page concernée :

```twig
{{ include('_filemanager.html.twig') }}
```

Il pose l'instance partagée `<file-manager endpoint="{{ path('admin.fileManager.index') }}" hidden>`
et deux exemples de champs : une image simple (input + bouton « Parcourir »
injecté) et une galerie multiple.

## Intégration avec l'éditeur visuel (`@charlie404/visual-editor`)

`openFileManager` respecte le contrat `onBrowse: (url?) => Promise<string>` de
l'éditeur visuel en résolvant l'URL du média choisi :

```js
import { createEditor } from '@charlie404/visual-editor'
import { openFileManager } from '@charlie404/filemanager'

createEditor(target, {
  // ...vos options...
  onBrowse: () => openFileManager({ accept: 'image/*' }),
})
```

Variantes : `openFileManagerFile()` (renvoie le `FileItem` complet) et
`openFileManagerFiles()` (sélection multiple).

## Notes

- **Noms de fichiers** : slugifiés (minuscules, caractères non alphanumériques
  → `-`) et dédupliqués par suffixe `-1`, `-2`… en cas de collision.
- **Métadonnées** (`alt`, `title`) : stockées dans `<dossier>/.meta.json`
  (map `nom de fichier => {alt, title}`), suivies lors des renommages/déplacements.
- **Recadrage** : non destructif — un nouveau fichier `<stem>-<w>x<h>.<ext>` est
  écrit, l'original est conservé. Le format de sortie suit la source sauf si
  `format` (`jpeg`|`png`|`webp`) est fourni ; `quality` est exprimée en 0..1.
- **Sécurité** : tous les chemins sont résolus puis vérifiés comme restant sous
  la racine de stockage (protection contre le path traversal).
