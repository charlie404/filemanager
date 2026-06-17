// Point d'entrée JS à ajouter dans un projet Symfony pour activer
// l'élément <file-manager> de @charlie404/filemanager.
//
//   npm i @charlie404/filemanager
//
// Importez ce fichier depuis votre bundle principal (assets/app.js) :
//
//   import './filemanager.js'
//
// (AssetMapper : `importmap:require @charlie404/filemanager` puis le même import.)

import {
  FileManager,
  bindFileManagers,
  openFileManager,
} from '@charlie404/filemanager'

// 1) Enregistre l'élément personnalisé <file-manager> et fixe l'endpoint REST.
//    Ce préfixe doit correspondre à celui du contrôleur Symfony
//    (App\Controller\FileManagerController : #[Route('/admin/file-manager')]).
FileManager.register('file-manager', { endpoint: '/admin/file-manager' })

// 2) Câble tous les champs `data-filemanager` / `data-filemanager-multiple`
//    présents dans la page (input + bouton « Parcourir », galerie…).
//    À rappeler après toute injection HTML dynamique (Turbo, modale Ajax, etc.).
bindFileManagers()

// 3) Adaptateur pour @charlie404/visual-editor (éditeur visuel) :
//    `openFileManager` respecte le contrat `onBrowse: (url?) => Promise<string>`
//    en résolvant l'URL du fichier choisi. Branchez-le à l'initialisation
//    de l'éditeur, par exemple :
//
//      import { createEditor } from '@charlie404/visual-editor'
//      import { openFileManager } from '@charlie404/filemanager'
//
//      createEditor(target, {
//        // ...vos options...
//        onBrowse: () => openFileManager({ accept: 'image/*' }),
//        // variantes utiles :
//        //   openFileManagerFile()  -> Promise<FileItem> (objet complet)
//        //   openFileManagerFiles() -> Promise<FileItem[]> (sélection multiple)
//      })
//
// `openFileManager` est exporté ci-dessus pour rester à portée de main.
export { openFileManager }
