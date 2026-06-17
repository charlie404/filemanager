{{--
    @charlie404/filemanager — example markup.

    Include this partial inside a page (e.g. @include('_filemanager')). It needs:
      1. A CSRF meta tag in your <head> (Laravel ships this snippet by default):

             <meta name="csrf-token" content="{{ csrf_token() }}">

      2. The compiled JS entry loaded once (via @vite or a plain <script>):

             @vite('resources/js/filemanager.js')

    The single shared <file-manager> instance is placed once per page and stays
    hidden until a field opens it. `url('/admin/file-manager')` builds the
    absolute endpoint, matching the route group in routes/filemanager.php.
--}}

{{-- The shared, hidden modal instance (one per page). --}}
<file-manager endpoint="{{ url('/admin/file-manager') }}" hidden></file-manager>

<form method="post" action="{{ url('/admin/save') }}">
    @csrf

    {{-- Single-value field: a text input + an injected "browse" button that
         writes the chosen file's url into the input. `data-filemanager-accept`
         restricts the picker; `data-filemanager-crop-ratio` constrains crops. --}}
    <label for="cover">Cover image</label>
    <input
        type="text"
        id="cover"
        name="cover"
        value="{{ old('cover') }}"
        data-filemanager
        data-filemanager-accept="image/*"
        data-filemanager-crop-ratio="16:9"
    >

    {{-- Multiple-value gallery field: the binding turns this into a chip list and
         submits repeated `gallery[]` hidden inputs. Pre-seed by putting one url
         per line in the value. --}}
    <label for="gallery">Gallery</label>
    <input
        type="text"
        id="gallery"
        name="gallery[]"
        value="{{ collect(old('gallery', []))->implode("\n") }}"
        data-filemanager
        data-filemanager-multiple
        data-filemanager-accept="image/*"
    >

    <button type="submit">Save</button>
</form>
