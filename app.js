
/* =========================================================
   ACM TECHPULSE 2026 — TREASURE HUNT
   Frontend: HTML + CSS + JavaScript
   Backend: Supabase
========================================================= */

/* 1. SUPABASE CONFIGURATION */

const SUPABASE_URL = "https://yacwbdypjygdlyzirxho.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_6kTIqMMKxDRO7VMcbRVzYg_Go__y_HZ";
const RANDOM_AUDIO_BUCKET = "stage-audios";
const RANDOM_AUDIO_EXTENSIONS = /\.(mp3|wav|m4a|ogg|aac|webm)$/i;

const supabaseClient = window.supabase?.createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY,
  {
    auth: {
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: "pkce",
      persistSession: true
    }
  }
);

/* 2. STAGES */

const STAGES = [
  {
    number: 1,
    title: "The First Gate",
    description: "Every great journey starts with a discovery.",
    icon: "door-open"
  },
  {
    number: 2,
    title: "The Hidden Passage",
    description: "Listen carefully. The next clue may be hidden in sound.",
    icon: "audio-lines"
  },
  {
    number: 3,
    title: "The Ancient Cipher",
    description: "Decode the mystery and uncover the next secret.",
    icon: "binary"
  },
  {
    number: 4,
    title: "The Final Trial",
    description: "You are close. Think carefully before entering the code.",
    icon: "brain"
  }
];

const LOCAL_CLUE_AUDIO_FILES = Array.from(
  { length: 10 },
  (_, index) => `./Audio/Clue-Audio-${index + 1}.wav`
);

/* 3. STAGE 3 RANDOM IMAGES */

const STAGE3_IMAGES = Array.from(
  { length: 15 },
  (_, index) => `./Codes/Code-${index + 1}.jpeg`
);

let currentStage3Image = "";

function hideStage3Image() {
  const panel = $("stage3ImagePanel");
  const image = $("stage3RandomImage");
  const status = $("stage3ImageStatus");

  if (panel) panel.classList.add("hidden");

  if (image) {
    image.onload = null;
    image.onerror = null;
    image.removeAttribute("src");
  }

  if (status) status.textContent = "";

  currentStage3Image = "";
}

function showRandomStage3Image() {
  const panel = $("stage3ImagePanel");
  const image = $("stage3RandomImage");
  const status = $("stage3ImageStatus");

  if (!panel || !image) {
    console.error(
      "Stage 3 image elements are missing. Check index.html."
    );
    return;
  }

  // Avoid showing the immediately previous image again.
  const availableImages = STAGE3_IMAGES.filter(
    path => path !== currentStage3Image
  );

  const imagePool = availableImages.length
    ? availableImages
    : STAGE3_IMAGES;

  const selectedImage =
    imagePool[Math.floor(Math.random() * imagePool.length)];

  currentStage3Image = selectedImage;

  panel.classList.remove("hidden");

  if (status) {
    status.textContent = "Loading visual clue...";
  }

  image.onload = () => {
    if (status) {
      status.textContent =
        "Study the image carefully to solve the clue.";
    }
  };

  image.onerror = () => {
    if (status) {
      status.textContent =
        `Unable to load ${selectedImage}. Check the Codes folder and filename.`;
    }

    console.error("Stage 3 image failed to load:", selectedImage);
  };

  image.src = selectedImage;
}

/* 4. APPLICATION STATE */

let currentUser = null;
let currentTeam = null;
let currentStage = 1;
let completedStages = [];
let authInitialized = false;
let randomAudioRequestId = 0;

/* 5. DOM HELPERS */

function $(id) {
  return document.getElementById(id);
}

function showElement(element) {
  if (!element) return;

  element.classList.remove("hidden");

  if (element.classList.contains("screen")) {
    element.classList.add("active");
  }
}

function hideElement(element) {
  if (!element) return;

  element.classList.add("hidden");

  if (element.classList.contains("screen")) {
    element.classList.remove("active");
  }
}

function showScreen(screenId) {
  ["login", "teamRegistration", "home", "stage", "vault"].forEach(id => {
    const screen = $(id);
    if (!screen) return;

    if (id === screenId) {
      showElement(screen);
    } else {
      hideElement(screen);
    }
  });

  window.scrollTo({ top: 0, behavior: "smooth" });
  window.lucide?.createIcons();
}

function showMessage(elementId, message, type = "error") {
  const element = $(elementId);
  if (!element) return;

  element.textContent = message;
  element.classList.remove("hidden", "success", "error", "info");
  element.classList.add(type);
}

function clearMessage(elementId) {
  const element = $(elementId);
  if (!element) return;

  element.textContent = "";
  element.classList.add("hidden");
  element.classList.remove("success", "error", "info");
}

function setButtonLoading(button, loading, loadingText = "Please wait...") {
  if (!button) return;

  if (loading) {
    if (!button.dataset.originalHtml) {
      button.dataset.originalHtml = button.innerHTML;
    }

    button.disabled = true;
    button.textContent = loadingText;
  } else {
    button.disabled = false;

    if (button.dataset.originalHtml) {
      button.innerHTML = button.dataset.originalHtml;
      delete button.dataset.originalHtml;
    }
  }
}

function getErrorMessage(error) {
  return error?.message || "Something went wrong. Please try again.";
}

/* 6. GOOGLE AUTHENTICATION */

async function loginWithGoogle() {
  if (!supabaseClient) {
    showMessage("loginMessage", "Supabase configuration is missing.");
    return;
  }

  const button = $("googleLoginBtn");
  setButtonLoading(button, true, "Connecting to Google...");
  clearMessage("loginMessage");

  try {
    const { error } = await supabaseClient.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin + window.location.pathname
      }
    });

    if (error) throw error;
  } catch (error) {
    console.error("Google login error:", error);
    showMessage("loginMessage", getErrorMessage(error));
    setButtonLoading(button, false);
  }
}

async function restoreCurrentUser() {
  const { data, error } = await supabaseClient.auth.getSession();
  if (error) throw error;

  if (data.session?.user) {
    currentUser = data.session.user;
    return currentUser;
  }

  currentUser = null;
  throw new Error(
    "Your Google sign-in session was not saved in this browser. " +
    "Please sign in again, then register your team."
  );
}

async function logoutUser() {
  if (!supabaseClient) return;

  try {
    stopAllAudio();
    hideStage3Image();

    const { error } = await supabaseClient.auth.signOut();
    if (error) throw error;

    currentUser = null;
    currentTeam = null;
    currentStage = 1;
    completedStages = [];

    showScreen("login");
  } catch (error) {
    console.error("Logout error:", error);
    alert("Could not sign out. Please try again.");
  }
}

window.logoutUser = logoutUser;

/* 7. AUTH SESSION */

async function initializeAuthentication() {
  if (!supabaseClient || authInitialized) return;

  authInitialized = true;

  supabaseClient.auth.onAuthStateChange((event, session) => {
    if (event === "SIGNED_OUT") {
      currentUser = null;
      currentTeam = null;
      completedStages = [];

      stopAllAudio();
      hideStage3Image();
      showScreen("login");
      return;
    }

    if (
      (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") &&
      session
    ) {
      currentUser = session.user;
      queueMicrotask(() => {
        handleSession(session).catch(error => {
          console.error("Auth session handling error:", error);
          showMessage("loginMessage", getErrorMessage(error));
        });
      });
    }
  });

  const { data, error } = await supabaseClient.auth.getSession();

  if (error) {
    console.error("Session error:", error);
    showMessage("loginMessage", getErrorMessage(error));
    showScreen("login");
    return;
  }

  await handleSession(data.session);
}

async function handleSession(session) {
  if (!session?.user) {
    currentUser = null;
    currentTeam = null;
    completedStages = [];
    showScreen("login");
    return;
  }

  currentUser = session.user;

  const name =
    currentUser.user_metadata?.full_name ||
    currentUser.user_metadata?.name ||
    currentUser.email ||
    "Participant";

  if ($("userName")) {
    $("userName").textContent = name;
  }

  await loadTeamForCurrentUser();
}

/* 8. TEAM REGISTRATION */

async function loadTeamForCurrentUser() {
  if (!currentUser || !supabaseClient) return;

  try {
    const { data, error } = await supabaseClient
      .from("teams")
      .select("id, team_name, auth_user_id, started_at, completed_at")
      .eq("auth_user_id", currentUser.id)
      .maybeSingle();

    if (error) throw error;

    if (data) {
      currentTeam = data;
      await loadTeamProgress();
      showScreen("home");
      updateDashboard();
    } else {
      currentTeam = null;
      showScreen("teamRegistration");
    }
  } catch (error) {
    console.error("Loading team error:", error);

    showMessage(
      "teamRegistrationMessage",
      `Could not load your team: ${getErrorMessage(error)}`
    );

    showScreen("teamRegistration");
  }
}

async function registerTeam(event) {
  event.preventDefault();

  const teamName = $("teamNameInput")?.value.trim();
  const button = $("registerTeamBtn");

  clearMessage("teamRegistrationMessage");

  if (!teamName || teamName.length < 2 || teamName.length > 60) {
    showMessage(
      "teamRegistrationMessage",
      "Enter a team name between 2 and 60 characters."
    );
    return;
  }

  setButtonLoading(button, true, "Registering team...");

  try {
    await restoreCurrentUser();

    const { data, error } = await supabaseClient.rpc("register_team", {
      p_team_name: teamName
    });

    if (error) throw error;
    if (!data) throw new Error("Team registration returned no team ID.");

    await loadTeamForCurrentUser();
  } catch (error) {
    console.error("Team registration error:", error);
    showMessage("teamRegistrationMessage", getErrorMessage(error));
  } finally {
    setButtonLoading(button, false);
  }
}

/* 9. LOAD TEAM PROGRESS */

async function loadTeamProgress() {
  if (!currentTeam || !supabaseClient) return;

  try {
    const { data, error } = await supabaseClient
      .from("team_stage_progress")
      .select("stage_number, completed_at")
      .eq("team_id", currentTeam.id);

    if (error) throw error;

    completedStages = (data || [])
      .filter(row => row.completed_at)
      .map(row => Number(row.stage_number))
      .filter(n => Number.isInteger(n) && n >= 1 && n <= STAGES.length)
      .filter((stage, index, stages) => stages.indexOf(stage) === index);

    updateDashboard();
  } catch (error) {
    console.error("Progress loading error:", error);
  }
}

/* 10. DASHBOARD */

function updateDashboard() {
  const count = completedStages.length;

  if ($("progressCount")) {
    $("progressCount").textContent = `${count} / ${STAGES.length}`;
  }

  if ($("progressBar")) {
    $("progressBar").style.width =
      `${(count / STAGES.length) * 100}%`;
  }

  const list = $("stageList");

  if (list) {
    list.replaceChildren();

    STAGES.forEach(stage => {
      const completed = completedStages.includes(stage.number);
      const unlocked = isStageUnlocked(stage.number);

      const item = document.createElement("li");
      item.className = "stage-list-item";

      if (completed) item.classList.add("completed");
      if (unlocked && !completed) item.classList.add("unlocked");

      const icon = document.createElement("span");
      icon.className = "stage-list-icon";

      const iconElement = document.createElement("i");
      iconElement.setAttribute(
        "data-lucide",
        completed ? "check" : unlocked ? "unlock" : "lock"
      );

      icon.appendChild(iconElement);

      const details = document.createElement("div");
      details.className = "stage-list-details";

      const title = document.createElement("strong");
      title.textContent = `Stage ${String(stage.number).padStart(2, "0")}`;

      const subtitle = document.createElement("span");
      subtitle.textContent = stage.title;

      details.append(title, subtitle);

      const status = document.createElement("span");
      status.className = "stage-list-status";
      status.textContent = completed
        ? "Completed"
        : unlocked
          ? "Available"
          : "Locked";

      item.append(icon, details, status);
      list.appendChild(item);
    });
  }

  window.lucide?.createIcons();
}

function isStageUnlocked(stageNumber) {
  if (stageNumber === 1) return true;
  return completedStages.includes(stageNumber - 1);
}

/* 11. ENTER THE HUNT */

async function enterHunt() {
  if (!currentTeam) {
    showScreen("teamRegistration");
    return;
  }

  await loadTeamProgress();

  if (completedStages.length === STAGES.length) {
    showScreen("vault");
    playTreasureAnimation();
    return;
  }

  const nextStage = STAGES.find(
    stage => !completedStages.includes(stage.number)
  );

  openStage(nextStage ? nextStage.number : 1);
}

/* 12. OPEN STAGE */

function openStage(stageNumber) {
  const stage = STAGES.find(
    item => item.number === Number(stageNumber)
  );

  if (!stage) return;

  if (
    !isStageUnlocked(stage.number) &&
    !completedStages.includes(stage.number)
  ) {
    showMessage(
      "stageMessage",
      "Complete the previous stage to unlock this one."
    );
    return;
  }

  currentStage = stage.number;

  if ($("stageNumber")) {
    $("stageNumber").textContent =
      String(stage.number).padStart(2, "0");
  }

  if ($("stageTitle")) {
    $("stageTitle").textContent = stage.title;
  }

  if ($("stageDescription")) {
    $("stageDescription").textContent = stage.description;
  }

  if ($("stageIcon")) {
    $("stageIcon").setAttribute("data-lucide", stage.icon);
  }

  if ($("stageProgressBar")) {
    $("stageProgressBar").style.width =
      `${(stage.number / STAGES.length) * 100}%`;
  }

  if ($("stageCode")) {
    $("stageCode").value = "";
  }

  clearMessage("stageMessage");

  // Stage 3: show a random image.
  // Other stages: keep the image panel hidden.
  if (stage.number === 3) {
    showRandomStage3Image();
  } else {
    hideStage3Image();
  }

  // Audio clues are available only in Stage 2.
  setupStageAudio(stage.number);

  showScreen("stage");
}

/* 13. VERIFY STAGE CODE */

async function submitStageCode(event) {
  event.preventDefault();

  if (!currentUser || !currentTeam) {
    showScreen("login");
    return;
  }

  const input = $("stageCode");
  const button = $("submitCodeBtn");
  const code = input?.value.trim();

  clearMessage("stageMessage");

  if (!/^\d{4}$/.test(code || "")) {
    showMessage("stageMessage", "Enter a valid 4-digit code.");
    return;
  }

  if (completedStages.includes(currentStage)) {
    showMessage(
      "stageMessage",
      "This stage is already completed.",
      "success"
    );
    return;
  }

  setButtonLoading(button, true, "Verifying code...");

  try {
    const { data, error } = await supabaseClient.rpc(
      "submit_stage_code",
      {
        p_stage_number: currentStage,
        p_code: code
      }
    );

    if (error) throw error;

    if (data !== true) {
      showMessage(
        "stageMessage",
        "Incorrect code. Check the clue and try again."
      );

      input?.select();
      return;
    }

    await loadTeamProgress();

    showMessage(
      "stageMessage",
      "Correct code! Stage unlocked.",
      "success"
    );

    updateDashboard();

    const completedStageNumber = currentStage;

    window.setTimeout(() => {
      if (completedStageNumber === STAGES.length) {
        showScreen("vault");
        playTreasureAnimation();
      } else {
        openStage(completedStageNumber + 1);
      }
    }, 900);
  } catch (error) {
    console.error("Stage verification error:", error);
    showMessage("stageMessage", getErrorMessage(error));
  } finally {
    setButtonLoading(button, false);
  }
}

/* 14. AUDIO HELPERS */

function stopPlayer(player) {
  if (!player) return;

  player.pause();
  player.removeAttribute("src");
  player.load();
}

function stopAllAudio() {
  stopPlayer($("localClueAudioPlayer"));
  stopPlayer($("randomAudioPlayer"));
}

function hideStageAudio() {
  randomAudioRequestId++;

  $("clueAudioPanel")?.classList.remove("visible");

  stopPlayer($("localClueAudioPlayer"));
  stopPlayer($("randomAudioPlayer"));

  if ($("clueAudioSelect")) {
    $("clueAudioSelect").value = "";
  }

  if ($("localClueAudioStatus")) {
    $("localClueAudioStatus").textContent = "";
  }

  setRandomAudioStatus("");
}

/* 15. SETUP STAGE AUDIO */

function setupStageAudio(stageNumber) {
  const panel = $("clueAudioPanel");
  if (!panel) return;

  if (Number(stageNumber) !== 2) {
    hideStageAudio();
    return;
  }

  panel.classList.add("visible");

  if ($("localClueAudioStatus") && !$("clueAudioSelect")?.value) {
    $("localClueAudioStatus").textContent =
      "Select a clue to listen.";
  }

  loadRandomAudio();
}

/* 16. LOCAL AUDIO EVENTS */

function initializeLocalAudioEvents() {
  const select = $("clueAudioSelect");
  const player = $("localClueAudioPlayer");
  const status = $("localClueAudioStatus");

  if (!select || !player || select.dataset.initialized === "true") {
    return;
  }

  select.dataset.initialized = "true";

  select.addEventListener("change", () => {
    const audioPath = select.value;

    stopPlayer(player);

    if (!audioPath) {
      if (status) {
        status.textContent = "Select a clue to listen.";
      }
      return;
    }

    if (!LOCAL_CLUE_AUDIO_FILES.includes(audioPath)) {
      select.value = "";

      if (status) {
        status.textContent = "Invalid audio clue selected.";
      }
      return;
    }

    player.src = audioPath;
    player.load();

    if (status) {
      status.textContent =
        "Audio clue selected. Press Play to listen.";
    }
  });

  player.addEventListener("canplay", () => {
    if (currentStage === 2 && status) {
      status.textContent = "Audio ready. Listen carefully.";
    }
  });

  player.addEventListener("ended", () => {
    if (currentStage === 2 && status) {
      status.textContent =
        "Audio finished. You can replay it.";
    }
  });

  player.addEventListener("error", () => {
    if (currentStage === 2 && status) {
      status.textContent =
        "Unable to load this file. Check the Audio folder and filename.";
    }
  });
}

/* 17. RANDOM SUPABASE AUDIO */

function setRandomAudioStatus(message) {
  const status = $("randomAudioStatus");
  if (status) status.textContent = message;
}

async function listRandomAudioFiles(prefix = "", depth = 0) {
  if (depth > 8) {
    throw new Error("Audio bucket folders are nested too deeply.");
  }

  const files = [];
  let offset = 0;

  while (true) {
    const { data, error } = await supabaseClient.storage
      .from(RANDOM_AUDIO_BUCKET)
      .list(prefix, {
        limit: 100,
        offset,
        sortBy: {
          column: "name",
          order: "asc"
        }
      });

    if (error) throw error;

    const entries = data || [];
    const folders = [];

    for (const entry of entries) {
      const path = prefix
        ? `${prefix}/${entry.name}`
        : entry.name;

      if (
        RANDOM_AUDIO_EXTENSIONS.test(entry.name) ||
        entry.metadata?.mimetype?.startsWith("audio/")
      ) {
        files.push({
          name: entry.name,
          path
        });
      } else if (
        entry.id === null &&
        entry.metadata === null
      ) {
        folders.push(path);
      }
    }

    for (const folder of folders) {
      files.push(
        ...await listRandomAudioFiles(folder, depth + 1)
      );
    }

    if (entries.length < 100) break;

    offset += entries.length;
  }

  return files;
}

async function loadRandomAudio() {
  const player = $("randomAudioPlayer");

  if (!player || !supabaseClient) {
    setRandomAudioStatus(
      "Supabase audio is unavailable. Check the connection and player."
    );
    return;
  }

  const requestId = ++randomAudioRequestId;

  if (player.dataset.randomAudioEventsInitialized !== "true") {
    player.dataset.randomAudioEventsInitialized = "true";

    player.addEventListener("canplay", () => {
      if (
        currentStage === 2 &&
        player.dataset.selectedAudioUrl
      ) {
        setRandomAudioStatus(
          "Random audio ready. Press Play to listen."
        );
      }
    });

    player.addEventListener("error", () => {
      if (
        currentStage !== 2 ||
        !player.dataset.selectedAudioPath
      ) {
        return;
      }

      const messages = {
        1: "Audio loading was cancelled.",
        2: "Network error. Check internet and Supabase Storage access.",
        3: "Audio decoding failed. Try a valid MP3 or WAV file.",
        4: "Audio source is unavailable or its format is unsupported."
      };

      const message =
        messages[player.error?.code] ||
        "Unable to play the audio.";

      setRandomAudioStatus(
        `${message} File: ${player.dataset.selectedAudioPath}`
      );
    });
  }

  setRandomAudioStatus(
    "Finding a random audio file from Supabase..."
  );

  try {
    const files = await listRandomAudioFiles();

    if (
      requestId !== randomAudioRequestId ||
      currentStage !== 2
    ) {
      return;
    }

    if (!files.length) {
      throw new Error(
        `No audio files found in the "${RANDOM_AUDIO_BUCKET}" bucket.`
      );
    }

    const selectedFile =
      files[Math.floor(Math.random() * files.length)];

    setRandomAudioStatus(
      `Preparing audio: ${selectedFile.name}...`
    );

    const { data, error } = await supabaseClient.storage
      .from(RANDOM_AUDIO_BUCKET)
      .createSignedUrl(selectedFile.path, 3600);

    if (error) throw error;

    if (!data?.signedUrl) {
      throw new Error("Could not generate an audio URL.");
    }

    if (
      requestId !== randomAudioRequestId ||
      currentStage !== 2
    ) {
      return;
    }

    stopPlayer(player);

    player.dataset.selectedAudioPath = selectedFile.path;
    player.dataset.selectedAudioUrl = data.signedUrl;

    player.src = data.signedUrl;
    player.load();

    setRandomAudioStatus(
      `Random audio selected: ${selectedFile.name}. Press Play to listen.`
    );
  } catch (error) {
    console.error("Random Supabase audio error:", error);

    if (
      requestId === randomAudioRequestId &&
      currentStage === 2
    ) {
      setRandomAudioStatus(
        `Could not load Supabase audio: ${getErrorMessage(error)}`
      );
    }
  }
}

/* 18. TREASURE CHEST ANIMATION */

function playTreasureAnimation() {
  const visual = $("vaultVisual");
  if (!visual) return;

  visual.classList.remove("treasure-open");
  void visual.offsetWidth;

  window.requestAnimationFrame(() => {
    visual.classList.add("treasure-open");
  });
}

function replayTreasureAnimation() {
  playTreasureAnimation();
}

/* 19. BUTTON AND FORM EVENTS */

function initializeEventListeners() {
  $("googleLoginBtn")?.addEventListener(
    "click",
    loginWithGoogle
  );

  $("teamRegistrationForm")?.addEventListener(
    "submit",
    registerTeam
  );

  $("enterHuntBtn")?.addEventListener(
    "click",
    enterHunt
  );

  $("codeForm")?.addEventListener(
    "submit",
    submitStageCode
  );

  $("backHomeBtn")?.addEventListener("click", async () => {
    await loadTeamProgress();
    showScreen("home");
  });

  $("logoutBtn")?.addEventListener(
    "click",
    logoutUser
  );

  $("restartBtn")?.addEventListener("click", async () => {
    await loadTeamProgress();
    showScreen("home");
  });

  $("replayTreasureBtn")?.addEventListener(
    "click",
    replayTreasureAnimation
  );

  $("stageCode")?.addEventListener("input", event => {
    event.target.value = event.target.value
      .replace(/\D/g, "")
      .slice(0, 4);
  });

  initializeLocalAudioEvents();
}

/* 20. INITIALIZE APPLICATION */

async function initializeApp() {
  if (!supabaseClient) {
    console.error(
      "Supabase initialization failed. Check the CDN and credentials."
    );

    showScreen("login");

    showMessage(
      "loginMessage",
      "Unable to initialize Supabase. Check the project URL and publishable key."
    );

    return;
  }

  initializeEventListeners();
  window.lucide?.createIcons();

  await initializeAuthentication();
}

document.addEventListener(
  "DOMContentLoaded",
  initializeApp
);
