(() => {
    // Put audio files in public/music and add tracks here. Use paths relative to index.html;
    // for example: { title: "My Song", artist: "Artist", src: "public/music/my-song.mp3" }.
    // A track may also include cover: "assets/my-album-cover.jpg".
    const PLAYLIST = [
        {
            title: "BOW BOW BOW X MONSTER (Full Remix)",
            artist: "Local MP3",
            src: "\u058D.mp3"
        }
    ];
    const DEFAULT_COVER = "assets/music-cover.svg";
    const REPEAT_MODES = ["off", "all", "one"];

    const player = document.querySelector(".music-player");
    const audio = player?.querySelector(".music-player__audio");
    const title = player?.querySelector(".music-player__title");
    const artist = player?.querySelector(".music-player__artist");
    const seek = player?.querySelector(".music-player__seek");
    const volume = player?.querySelector(".music-player__volume");
    const elapsed = player?.querySelector(".music-player__elapsed");
    const duration = player?.querySelector(".music-player__duration");
    const status = player?.querySelector(".music-player__status");
    const playButton = player?.querySelector(".music-player__play");
    const previousButton = player?.querySelector(".music-player__previous");
    const nextButton = player?.querySelector(".music-player__next");
    const shuffleButton = player?.querySelector(".music-player__shuffle");
    const repeatButton = player?.querySelector(".music-player__repeat");
    const coverImages = [...(player?.querySelectorAll(".music-player__cover, .music-player__collapsed-toggle img") || [])];
    const collapseButton = player?.querySelector(".music-player__collapse");
    const expandButton = player?.querySelector(".music-player__collapsed-toggle");
    const panel = player?.querySelector(".music-player__panel");
    const mobileLayout = window.matchMedia("(max-width: 600px)");

    if (!player || !audio || !title || !artist || !seek || !volume || !elapsed || !duration || !status
        || !playButton || !previousButton || !nextButton || !shuffleButton || !repeatButton
        || !collapseButton || !expandButton || !panel) {
        console.error("Music player could not initialize because required player elements are missing.");
        return;
    }

    let currentIndex = -1;
    let repeatMode = 0;
    let shuffleEnabled = false;
    let shuffleHistory = [];

    function formatTime(seconds) {
        if (!Number.isFinite(seconds) || seconds < 0) {
            return "0:00";
        }

        const wholeSeconds = Math.floor(seconds);
        const minutes = Math.floor(wholeSeconds / 60);
        return `${minutes}:${String(wholeSeconds % 60).padStart(2, "0")}`;
    }

    function setStatus(message, state = "info") {
        status.textContent = message;
        status.dataset.state = state;
    }

    function updateProgress() {
        const hasDuration = Number.isFinite(audio.duration) && audio.duration > 0;
        const currentTime = Number.isFinite(audio.currentTime) ? audio.currentTime : 0;
        const totalTime = hasDuration ? audio.duration : 0;

        seek.max = String(totalTime);
        const progress = hasDuration ? Math.min(currentTime / totalTime, 1) : 0;
        seek.value = String(hasDuration ? Math.min(currentTime, totalTime) : 0);
        seek.style.setProperty("--music-progress", `${progress * 100}%`);
        seek.setAttribute("aria-valuetext", `${formatTime(currentTime)} of ${formatTime(totalTime)}`);
        elapsed.textContent = formatTime(currentTime);
        duration.textContent = formatTime(totalTime);
    }

    function updateControls() {
        const hasTracks = PLAYLIST.length > 0 && currentIndex >= 0;
        const canSwitch = PLAYLIST.length > 1;
        const isPlaying = !audio.paused && !audio.ended;

        playButton.disabled = !hasTracks;
        previousButton.disabled = !canSwitch;
        nextButton.disabled = !canSwitch;
        seek.disabled = !hasTracks || !Number.isFinite(audio.duration) || audio.duration <= 0;
        shuffleButton.disabled = !canSwitch;
        repeatButton.disabled = !hasTracks;
        player.dataset.playing = String(isPlaying);
        playButton.setAttribute("aria-label", isPlaying ? "Pause" : "Play");
        shuffleButton.setAttribute("aria-pressed", String(shuffleEnabled));
        shuffleButton.setAttribute("aria-label", shuffleEnabled ? "Disable shuffle" : "Enable shuffle");
        repeatButton.setAttribute("aria-pressed", String(repeatMode !== 0));
        repeatButton.setAttribute("aria-label", `Repeat ${REPEAT_MODES[repeatMode]}`);
        repeatButton.dataset.mode = REPEAT_MODES[repeatMode];
    }

    function updateArtwork(track) {
        const cover = track.cover || DEFAULT_COVER;
        coverImages.forEach((image) => {
            image.dataset.fallbackApplied = "false";
            image.src = cover;
            image.alt = image.classList.contains("music-player__cover") ? `Cover art for ${track.title}` : "";
        });
    }

    function selectTrack(index, autoplay, rememberCurrent = true) {
        const track = PLAYLIST[index];
        if (!track) {
            setStatus("The selected track is not available.", "error");
            return;
        }

        if (rememberCurrent && currentIndex >= 0 && currentIndex !== index) {
            shuffleHistory.push(currentIndex);
        }

        audio.pause();
        currentIndex = index;
        title.textContent = track.title;
        artist.textContent = track.artist;
        updateArtwork(track);
        setStatus(`Ready to play: ${track.title}.`);
        audio.removeAttribute("src");
        audio.load();

        try {
            audio.src = new URL(track.src, document.baseURI).href;
            audio.load();
        } catch (error) {
            console.error(`Could not load music track "${track.title}".`, error);
            setStatus(`Could not load "${track.title}". Check its file path.`, "error");
        }

        updateProgress();
        updateControls();

        if (autoplay) {
            audio.play().catch((error) => {
                console.error(`Playback could not start for "${track.title}".`, error);
                setStatus(`Could not play "${track.title}". Check the file and audio format.`, "error");
                updateControls();
            });
        }
    }

    function getNextIndex() {
        if (!PLAYLIST.length) {
            return -1;
        }

        if (shuffleEnabled && PLAYLIST.length > 1) {
            const choices = PLAYLIST.map((_, index) => index).filter((index) => index !== currentIndex);
            return choices[Math.floor(Math.random() * choices.length)];
        }

        if (currentIndex + 1 < PLAYLIST.length) {
            return currentIndex + 1;
        }

        return repeatMode === 1 ? 0 : -1;
    }

    function playNext() {
        const nextIndex = getNextIndex();
        if (nextIndex < 0) {
            setStatus("Playlist finished. Choose a track to play again.");
            updateControls();
            return;
        }
        selectTrack(nextIndex, true);
    }

    function playPrevious() {
        if (audio.currentTime > 3) {
            audio.currentTime = 0;
            return;
        }

        if (shuffleEnabled && shuffleHistory.length) {
            const previousIndex = shuffleHistory.pop();
            selectTrack(previousIndex, true, false);
            return;
        }

        const previousIndex = currentIndex > 0 ? currentIndex - 1 : (repeatMode === 1 ? PLAYLIST.length - 1 : 0);
        if (previousIndex !== currentIndex) {
            selectTrack(previousIndex, true);
        } else {
            audio.currentTime = 0;
        }
    }

    async function togglePlayback() {
        if (currentIndex < 0) {
            return;
        }

        if (audio.paused) {
            try {
                await audio.play();
                setStatus(`Playing: ${PLAYLIST[currentIndex].title}.`);
            } catch (error) {
                console.error(`Playback could not start for "${PLAYLIST[currentIndex].title}".`, error);
                setStatus(`Could not play "${PLAYLIST[currentIndex].title}". Check the file and audio format.`, "error");
            }
        } else {
            audio.pause();
            setStatus(`Paused: ${PLAYLIST[currentIndex].title}.`);
        }
        updateControls();
    }

    function toggleCollapsed(collapsed) {
        player.dataset.collapsed = String(collapsed);
        panel.hidden = collapsed;
        collapseButton.setAttribute("aria-expanded", String(!collapsed));
        expandButton.setAttribute("aria-expanded", String(!collapsed));
        expandButton.setAttribute("aria-label", collapsed ? "Open music player" : "Music player is open");
    }

    playButton.addEventListener("click", togglePlayback);
    previousButton.addEventListener("click", playPrevious);
    nextButton.addEventListener("click", playNext);

    shuffleButton.addEventListener("click", () => {
        shuffleEnabled = !shuffleEnabled;
        shuffleHistory = [];
        updateControls();
        setStatus(shuffleEnabled ? "Shuffle is on." : "Shuffle is off.");
    });

    repeatButton.addEventListener("click", () => {
        repeatMode = (repeatMode + 1) % REPEAT_MODES.length;
        audio.loop = repeatMode === 2;
        updateControls();
        setStatus(`Repeat ${REPEAT_MODES[repeatMode]}.`);
    });

    seek.addEventListener("input", () => {
        const targetTime = Number(seek.value);
        if (Number.isFinite(targetTime) && Number.isFinite(audio.duration)) {
            audio.currentTime = targetTime;
            updateProgress();
        }
    });

    function updateVolume() {
        audio.volume = Number(volume.value);
        audio.muted = audio.volume === 0;
        volume.style.setProperty("--music-progress", `${Number(volume.value) * 100}%`);
    }

    volume.addEventListener("input", updateVolume);

    collapseButton.addEventListener("click", () => {
        toggleCollapsed(true);
        expandButton.focus();
    });
    expandButton.addEventListener("click", () => {
        toggleCollapsed(false);
        collapseButton.focus();
    });
    mobileLayout.addEventListener("change", (event) => toggleCollapsed(event.matches));

    coverImages.forEach((image) => {
        image.addEventListener("error", () => {
            if (image.dataset.fallbackApplied !== "true" && image.src !== new URL(DEFAULT_COVER, document.baseURI).href) {
                image.dataset.fallbackApplied = "true";
                image.src = DEFAULT_COVER;
            } else {
                console.error(`Music player cover image could not be loaded: ${image.src}`);
                image.hidden = true;
            }
        });
    });

    audio.addEventListener("loadedmetadata", () => {
        updateProgress();
        updateControls();
    });
    audio.addEventListener("durationchange", updateProgress);
    audio.addEventListener("timeupdate", updateProgress);
    audio.addEventListener("play", updateControls);
    audio.addEventListener("pause", updateControls);
    audio.addEventListener("ended", () => {
        updateControls();
        if (repeatMode === 2) {
            audio.currentTime = 0;
            audio.play().catch((error) => {
                console.error(`Track "${PLAYLIST[currentIndex]?.title}" could not repeat.`, error);
                setStatus("The track could not be repeated.", "error");
                updateControls();
            });
        } else {
            playNext();
        }
    });
    audio.addEventListener("error", () => {
        const track = PLAYLIST[currentIndex];
        if (!track) {
            return;
        }

        const errorCode = audio.error?.code;
        const detail = errorCode === 4
            ? "format is unsupported"
            : "file could not be found or loaded";
        console.error(`Music track "${track.title}" failed to load: ${detail}.`, audio.error);
        setStatus(`Could not load "${track.title}": ${detail}. Check its file path and format.`, "error");
        updateControls();
    });

    updateVolume();
    toggleCollapsed(mobileLayout.matches);
    if (PLAYLIST.length) {
        selectTrack(0, false, false);
    } else {
        setStatus("Add your music files and playlist entries to start listening.");
        updateControls();
    }
})();
