import type { Lang } from './types'

export interface Dict {
  title: string
  upload: string
  newFolder: string
  newFolderPrompt: string
  search: string
  empty: string
  emptyHint: string
  root: string
  cancel: string
  confirm: string
  insert: string
  insertN: (n: number) => string
  delete: string
  deleteConfirm: (name: string) => string
  deleteSelected: (n: number) => string
  rename: string
  renamePrompt: string
  move: string
  crop: string
  edit: string
  copyUrl: string
  copied: string
  download: string
  select: string
  selected: (n: number) => string
  nFiles: (n: number) => string
  sortName: string
  sortDate: string
  sortSize: string
  layoutGrid: string
  layoutRows: string
  // crop editor
  cropTitle: string
  ratioFree: string
  apply: string
  reset: string
  // metadata
  metaTitle: string
  alt: string
  altHint: string
  caption: string
  save: string
  saved: string
  // misc
  loading: string
  uploadError: string
  dropHere: string
  close: string
}

const en: Dict = {
  title: 'Media library',
  upload: 'Upload',
  newFolder: 'New folder',
  newFolderPrompt: 'Folder name',
  search: 'Search…',
  empty: 'This folder is empty',
  emptyHint: 'Drop files here or use the Upload button',
  root: 'Home',
  cancel: 'Cancel',
  confirm: 'Confirm',
  insert: 'Insert',
  insertN: (n) => `Insert ${n} file${n > 1 ? 's' : ''}`,
  delete: 'Delete',
  deleteConfirm: (name) => `Delete “${name}”? This cannot be undone.`,
  deleteSelected: (n) => `Delete ${n} selected file${n > 1 ? 's' : ''}?`,
  rename: 'Rename',
  renamePrompt: 'New name',
  move: 'Move',
  crop: 'Crop',
  edit: 'Edit',
  copyUrl: 'Copy URL',
  copied: 'Copied!',
  download: 'Download',
  select: 'Select',
  selected: (n) => `${n} selected`,
  nFiles: (n) => `${n} file${n > 1 ? 's' : ''}`,
  sortName: 'Name',
  sortDate: 'Date',
  sortSize: 'Size',
  layoutGrid: 'Grid',
  layoutRows: 'List',
  cropTitle: 'Crop image',
  ratioFree: 'Free',
  apply: 'Apply crop',
  reset: 'Reset',
  metaTitle: 'Details',
  alt: 'Alt text',
  altHint: 'Describes the image for screen readers and SEO',
  caption: 'Title',
  save: 'Save',
  saved: 'Saved',
  loading: 'Loading…',
  uploadError: 'Upload failed',
  dropHere: 'Drop to upload',
  close: 'Close',
}

const fr: Dict = {
  title: 'Médiathèque',
  upload: 'Téléverser',
  newFolder: 'Nouveau dossier',
  newFolderPrompt: 'Nom du dossier',
  search: 'Rechercher…',
  empty: 'Ce dossier est vide',
  emptyHint: 'Déposez des fichiers ici ou utilisez le bouton Téléverser',
  root: 'Accueil',
  cancel: 'Annuler',
  confirm: 'Confirmer',
  insert: 'Insérer',
  insertN: (n) => `Insérer ${n} fichier${n > 1 ? 's' : ''}`,
  delete: 'Supprimer',
  deleteConfirm: (name) => `Supprimer « ${name} » ? Action irréversible.`,
  deleteSelected: (n) => `Supprimer ${n} fichier${n > 1 ? 's' : ''} sélectionné${n > 1 ? 's' : ''} ?`,
  rename: 'Renommer',
  renamePrompt: 'Nouveau nom',
  move: 'Déplacer',
  crop: 'Recadrer',
  edit: 'Modifier',
  copyUrl: "Copier l'URL",
  copied: 'Copié !',
  download: 'Télécharger',
  select: 'Sélectionner',
  selected: (n) => `${n} sélectionné${n > 1 ? 's' : ''}`,
  nFiles: (n) => `${n} fichier${n > 1 ? 's' : ''}`,
  sortName: 'Nom',
  sortDate: 'Date',
  sortSize: 'Taille',
  layoutGrid: 'Grille',
  layoutRows: 'Liste',
  cropTitle: "Recadrer l'image",
  ratioFree: 'Libre',
  apply: 'Appliquer',
  reset: 'Réinitialiser',
  metaTitle: 'Détails',
  alt: 'Texte alternatif',
  altHint: "Décrit l'image pour les lecteurs d'écran et le SEO",
  caption: 'Titre',
  save: 'Enregistrer',
  saved: 'Enregistré',
  loading: 'Chargement…',
  uploadError: "Échec de l'envoi",
  dropHere: 'Déposer pour téléverser',
  close: 'Fermer',
}

const dicts: Record<Lang, Dict> = { en, fr }

/** Resolve a dictionary, inferring the language from `<html lang>` when unset. */
export function resolveDict(lang?: Lang | string | null): Dict {
  const code = (lang || document.documentElement.lang || 'en')
    .slice(0, 2)
    .toLowerCase()
  return dicts[code as Lang] ?? en
}
