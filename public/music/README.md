# Portfolio music

Put your own `.mp3`, `.ogg`, or `.wav` audio files in this folder. No music files are included.

Open `music-player.js` and add a track to the `PLAYLIST` near the top:

```js
{
    title: "My Song",
    artist: "Artist Name",
    src: "public/music/my-song.mp3",
    cover: "assets/music-cover.svg"
}
```

Use a path relative to `index.html`. Add more objects to build the playlist; remove objects to remove tracks. You can use a different local image for each `cover`.

The currently configured track is an existing MP3 in the repository root. Add your own files to this folder and update its `src` in `music-player.js` when you want to move or replace it.

If your hosting setup publishes the contents of `public/` at the site root, use `"music/my-song.mp3"` for `src` instead.
