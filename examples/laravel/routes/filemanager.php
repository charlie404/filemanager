<?php

declare(strict_types=1);

/*
|--------------------------------------------------------------------------
| @charlie404/filemanager routes
|--------------------------------------------------------------------------
|
| Include this file from your routes/web.php so the JSON routes share the
| `web` middleware group (session + cookies, which the element relies on for
| same-origin auth). Add this line to routes/web.php:
|
|     require __DIR__ . '/filemanager.php';
|
| These routes live under `web` so the browser sends the session cookie. The
| element's REST client uses fetch with `credentials: 'same-origin'`, so it
| also needs the CSRF token on the mutating requests. The simplest correct
| approach for Laravel 11 is to expose the token via a <meta> tag and pass it
| to register() as an X-CSRF-TOKEN header (see resources/js/filemanager.js and
| the README). No VerifyCsrfToken exemption is then required.
|
| `->where('id', '.*')` lets ids contain slashes (e.g. `products/2024/a.jpg`),
| matching the contract where an id is a path under the storage root.
|
*/

use App\Http\Controllers\FileManagerController;
use Illuminate\Support\Facades\Route;

Route::prefix('admin/file-manager')
    ->name('file-manager.')
    ->controller(FileManagerController::class)
    ->group(function (): void {
        // folders
        Route::get('folders', 'listFolders')->name('folders.index');
        Route::post('folders', 'createFolder')->name('folders.store');
        Route::put('folders/{id}', 'renameFolder')->where('id', '.*')->name('folders.update');
        Route::delete('folders/{id}', 'deleteFolder')->where('id', '.*')->name('folders.destroy');

        // files — fixed segments first so they win over the catch-all {id}
        Route::get('files', 'listFiles')->name('files.index');
        Route::post('files', 'uploadFile')->name('files.store');
        Route::post('files/move', 'moveFile')->name('files.move');
        Route::post('files/crop', 'cropFile')->name('files.crop');
        Route::put('files/{id}', 'updateFile')->where('id', '.*')->name('files.update');
        Route::delete('files/{id}', 'deleteFile')->where('id', '.*')->name('files.destroy');
    });
