(() => {
    const root = document.documentElement;
    const main = document.querySelector("main");
    const themeButton = document.querySelector(".theme-toggle");
    const menuButton = document.querySelector(".menu-toggle");
    const siteLinks = document.querySelector(".site-links");
    const transitionCurtain = document.querySelector(".page-transition");
    const readingProgress = document.querySelector(".reading-progress span");
    const yearElement = document.querySelector("#current-year");
    const projectCards = [...document.querySelectorAll(".project-card")];
    const filterButtons = [...document.querySelectorAll(".filter-button")];
    const projectDialog = document.querySelector(".project-dialog");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let isTransitioning = false;
    let progressFramePending = false;
    let returnFocusTarget = null;

    document.body.classList.add("js-ready");

    function applyTheme(theme) {
        root.classList.toggle("dark", theme === "dark");
        root.style.colorScheme = theme;
        if (themeButton) {
            const nextTheme = theme === "dark" ? "light" : "dark";
            themeButton.textContent = `${nextTheme} mode`;
            themeButton.setAttribute("aria-label", `Switch to ${nextTheme} theme`);
        }
    }

    let savedTheme = null;
    try {
        savedTheme = localStorage.getItem("taiwo-portfolio-theme");
    } catch (error) {
        console.warn("Theme preference could not be read from local storage.", error);
    }

    applyTheme(savedTheme || (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"));

    themeButton?.addEventListener("click", () => {
        const nextTheme = root.classList.contains("dark") ? "light" : "dark";
        applyTheme(nextTheme);
        try {
            localStorage.setItem("taiwo-portfolio-theme", nextTheme);
        } catch (error) {
            console.warn("Theme preference could not be saved to local storage.", error);
        }
    });

    function closeMenu() {
        siteLinks?.classList.remove("is-open");
        menuButton?.setAttribute("aria-expanded", "false");
    }

    menuButton?.addEventListener("click", () => {
        const isOpen = siteLinks?.classList.toggle("is-open") ?? false;
        menuButton.setAttribute("aria-expanded", String(isOpen));
    });

    function waitForCurtain() {
        return new Promise((resolve) => window.setTimeout(resolve, 380));
    }

    function focusTarget(target) {
        const heading = target.querySelector("h1, h2");
        if (heading) {
            heading.tabIndex = -1;
            heading.focus({ preventScroll: true });
        }
    }

    async function navigateTo(target, hash, updateHistory = true) {
        if (!target || isTransitioning) {
            return;
        }

        closeMenu();
        if (!transitionCurtain || reducedMotion.matches) {
            if (updateHistory && window.location.hash !== hash) {
                window.history.pushState(null, "", hash);
            }
            target.scrollIntoView({ behavior: "instant", block: "start" });
            focusTarget(target);
            return;
        }

        isTransitioning = true;
        if (main) {
            main.setAttribute("aria-busy", "true");
        }
        transitionCurtain.style.transformOrigin = "bottom";
        transitionCurtain.classList.add("is-active");
        await waitForCurtain();

        if (updateHistory && window.location.hash !== hash) {
            window.history.pushState(null, "", hash);
        }
        target.scrollIntoView({ behavior: "instant", block: "start" });
        focusTarget(target);

        transitionCurtain.style.transformOrigin = "top";
        transitionCurtain.classList.remove("is-active");
        await waitForCurtain();
        if (main) {
            main.removeAttribute("aria-busy");
        }
        isTransitioning = false;
    }

    document.addEventListener("click", (event) => {
        const link = event.target.closest("a[href^='#']");
        if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
            return;
        }

        const hash = link.getAttribute("href");
        const target = hash && document.querySelector(hash);
        if (!target) {
            return;
        }

        event.preventDefault();
        navigateTo(target, hash);
    });

    window.addEventListener("popstate", () => {
        const hash = window.location.hash || "#home";
        const target = document.querySelector(hash);
        if (target) {
            navigateTo(target, hash, false);
        }
    });

    function setProjectFilter(filter) {
        const normalizedFilter = filter.trim().toLowerCase().replace(/[\s/]+/g, "-");
        let visibleCount = 0;

        projectCards.forEach((card) => {
            const skills = (card.dataset.skills || "").toLowerCase().split(/\s+/);
            const matches = normalizedFilter === "all" || skills.includes(normalizedFilter);
            card.classList.toggle("is-filtered-out", !matches);
            if (matches) {
                visibleCount += 1;
            }
        });

        filterButtons.forEach((button) => {
            const selected = button.dataset.filter === normalizedFilter;
            button.classList.toggle("is-selected", selected);
            button.setAttribute("aria-pressed", String(selected));
        });

        document.querySelectorAll(".skill-chip").forEach((button) => {
            const selected = button.dataset.filterSkill === normalizedFilter;
            button.setAttribute("aria-pressed", String(selected));
        });

        const filterStatus = document.querySelector(".filter-status");
        const filterName = normalizedFilter === "all"
            ? "all projects"
            : filterButtons.find((button) => button.dataset.filter === normalizedFilter)?.textContent.trim()
                || document.querySelector(`.skill-chip[data-filter-skill="${CSS.escape(normalizedFilter)}"]`)?.textContent.trim()
                || filter;
        if (filterStatus) {
            filterStatus.textContent = visibleCount
                ? `Showing ${visibleCount} ${visibleCount === 1 ? "project" : "projects"} for ${filterName}.`
                : `No listed projects match ${filterName}.`;
        }
    }

    filterButtons.forEach((button) => {
        button.addEventListener("click", () => setProjectFilter(button.dataset.filter || "all"));
    });
    setProjectFilter("all");

    document.querySelectorAll(".skill-chip").forEach((button) => {
        button.addEventListener("click", () => {
            const filter = button.dataset.filterSkill || "";
            setProjectFilter(filter);
            const projects = document.querySelector("#projects");
            navigateTo(projects, "#projects");
        });
    });

    document.querySelectorAll(".experience-details").forEach((details) => {
        const summary = details.querySelector(".experience-toggle");
        details.addEventListener("toggle", () => {
            if (summary) {
                summary.textContent = details.open ? "Hide details" : "Show details";
            }
        });
    });

    function openProjectDialog(card, trigger) {
        if (!card || !projectDialog) {
            return;
        }

        returnFocusTarget = trigger;
        const title = card.querySelector(".project-info h3")?.textContent.trim() || "Project details";
        const description = card.querySelector(".project-info > p:not(.project-type)")?.textContent.trim() || "";
        const technologies = [...card.querySelectorAll(".project-info > .tag-list li")]
            .map((item) => item.textContent.trim());

        projectDialog.querySelector("#dialog-type").textContent =
            card.querySelector(".project-type")?.textContent.trim() || "PROJECT";
        projectDialog.querySelector("#dialog-title").textContent = title;
        projectDialog.querySelector(".dialog-description").textContent = description;
        const stack = projectDialog.querySelector(".dialog-stack");
        stack.replaceChildren();
        if (technologies.length) {
            const label = document.createElement("p");
            label.className = "filter-label";
            label.textContent = "TECHNOLOGIES";
            const list = document.createElement("ul");
            list.className = "tag-list";
            technologies.forEach((technology) => {
                const item = document.createElement("li");
                item.textContent = technology;
                list.append(item);
            });
            stack.append(label, list);
        }

        if (typeof projectDialog.showModal === "function") {
            projectDialog.showModal();
        } else {
            projectDialog.setAttribute("open", "");
        }
    }

    function closeProjectDialog() {
        if (projectDialog?.open) {
            projectDialog.close();
        }
    }

    document.querySelectorAll(".project-details-button").forEach((button) => {
        button.addEventListener("click", () => {
            openProjectDialog(button.closest(".project-card"), button);
        });
    });

    document.querySelectorAll(".project-art").forEach((button) => {
        button.addEventListener("click", () => {
            openProjectDialog(button.closest(".project-card"), button);
        });
    });

    projectDialog?.addEventListener("click", (event) => {
        if (event.target === projectDialog) {
            closeProjectDialog();
        }
    });

    projectDialog?.addEventListener("close", () => {
        returnFocusTarget?.focus();
        returnFocusTarget = null;
    });

    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
            closeMenu();
        }
    });

    document.querySelectorAll(".copy-button").forEach((button) => {
        button.addEventListener("click", async () => {
            const value = button.dataset.copy;
            if (!value) {
                return;
            }

            let copied = false;
            if (navigator.clipboard?.writeText) {
                let timeoutId;
                try {
                    await Promise.race([
                        navigator.clipboard.writeText(value),
                        new Promise((_, reject) => {
                            timeoutId = window.setTimeout(() => reject(new Error("Clipboard request timed out.")), 1200);
                        })
                    ]);
                    copied = true;
                } catch (error) {
                    console.warn("Clipboard API was unavailable; trying the selection fallback.", error);
                } finally {
                    window.clearTimeout(timeoutId);
                }
            }

            if (!copied) {
                const temporaryInput = document.createElement("textarea");
                temporaryInput.value = value;
                temporaryInput.setAttribute("readonly", "");
                temporaryInput.className = "clipboard-fallback";
                document.body.append(temporaryInput);
                temporaryInput.select();
                copied = document.execCommand("copy");
                temporaryInput.remove();
            }

            showNotice(copied
                ? (value.includes("@") ? "Email address copied." : "Phone number copied.")
                : `Copy unavailable. ${value}`);
        });
    });

    function updateReadingProgress() {
        progressFramePending = false;
        if (!readingProgress) {
            return;
        }

        const scrollableHeight = document.documentElement.scrollHeight - window.innerHeight;
        const progress = scrollableHeight > 0 ? Math.min(window.scrollY / scrollableHeight, 1) : 0;
        readingProgress.style.width = `${progress * 100}%`;
    }

    window.addEventListener("scroll", () => {
        if (!progressFramePending) {
            progressFramePending = true;
            window.requestAnimationFrame(updateReadingProgress);
        }
    }, { passive: true });
    updateReadingProgress();

    if ("IntersectionObserver" in window) {
        const sectionObserver = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                entry.target.classList.toggle("is-ambient-active", entry.isIntersecting);
                if (!entry.isIntersecting) {
                    return;
                }
                const currentId = entry.target.id;
                siteLinks?.querySelectorAll("a[href^='#']").forEach((link) => {
                    if (link.getAttribute("href") === `#${currentId}`) {
                        link.setAttribute("aria-current", "location");
                    } else {
                        link.removeAttribute("aria-current");
                    }
                });
            });
        }, { rootMargin: "-12% 0px -22% 0px" });

        document.querySelectorAll("main section[id]").forEach((section) => sectionObserver.observe(section));
    }

    const legoScenes = [...document.querySelectorAll(".lego-field")].map((field) => ({
        section: field.closest("section"),
        field,
        bricks: [...field.querySelectorAll(".lego-brick")]
    })).filter((scene) => scene.section);
    let legoFramePending = false;

    function updateLegoScroll() {
        legoFramePending = false;
        legoScenes.forEach(({ section, field, bricks }) => {
            if (reducedMotion.matches) {
                field.style.removeProperty("--scroll-drift");
                bricks.forEach((brick) => brick.style.removeProperty("--scroll-rotation"));
                return;
            }

            const bounds = section.getBoundingClientRect();
            const scrollProgress = Math.min(Math.max(-bounds.top / bounds.height, 0), 1);
            field.style.setProperty("--scroll-drift", `${scrollProgress * 28}px`);
            bricks.forEach((brick, index) => {
                brick.style.setProperty("--scroll-rotation", `${(scrollProgress * 24 + index * 12) % 36}deg`);
            });
        });
    }

    function requestLegoScrollUpdate() {
        if (!legoFramePending) {
            legoFramePending = true;
            window.requestAnimationFrame(updateLegoScroll);
        }
    }

    window.addEventListener("scroll", requestLegoScrollUpdate, { passive: true });
    window.addEventListener("resize", requestLegoScrollUpdate, { passive: true });
    reducedMotion.addEventListener?.("change", updateLegoScroll);
    updateLegoScroll();

    if (yearElement) {
        yearElement.textContent = String(new Date().getFullYear());
    }

    function showNotice(message) {
        let notice = document.querySelector(".site-toast");
        if (!notice) {
            notice = document.createElement("div");
            notice.className = "site-toast";
            notice.setAttribute("role", "status");
            notice.setAttribute("aria-live", "polite");
            document.body.append(notice);
        }

        notice.textContent = message;
        window.clearTimeout(showNotice.timeout);
        showNotice.timeout = window.setTimeout(() => notice.remove(), 3500);
    }
})();
