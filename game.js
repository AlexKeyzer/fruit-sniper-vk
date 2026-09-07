/**
 * Фруктовый Снайпер - Полностью исправленный скрипт
 */

// Глобальные переменные
const holst = document.getElementById("igrovoePole");
const kist = holst.getContext("2d");

// UI Элементы
const uiMonety = document.getElementById("schetMonet");
const uiPanelMonet = document.getElementById("panelMonet"); 
const uiGlavnoeMenu = document.getElementById("glavnoeMenu");
const uiEkranProigrysha = document.getElementById("ekranProigrysha");
const uiEkranMagazina = document.getElementById("ekranMagazina");
const uiSetkaSkinov = document.getElementById("setkaSkinov");
const uiTekushiyUroven = document.getElementById("tekushiyUrovenUI");

const knopkaIgrat = document.getElementById("knopkaIgrat");
const knopkaZanovo = document.getElementById("knopkaZanovo");
const knopkaVoskresheniya = document.getElementById("knopkaVoskresheniya");
const knopkaMagazin = document.getElementById("knopkaMagazin");
const knopkaNazadIzMagazina = document.getElementById("knopkaNazadIzMagazina");
const knopkaZvuka = document.getElementById("knopkaZvuka");
const polzunokZvuka = document.getElementById("polzunokZvuka");

// Элементы HUD
const uiPanelLevel = document.getElementById("panelLevel");
const uiPanelNozhei = document.getElementById("panelNozhei");
const uiTekstLevel = document.getElementById("tekstLevel");
const uiTekstNozhei = document.getElementById("tekstNozhei");

// Предотвращаем контекстное меню и выделение
document.addEventListener('contextmenu', e => e.preventDefault());
document.addEventListener('selectstart', e => e.preventDefault());
document.addEventListener('dragstart', e => e.preventDefault());

const GAME_BASE_WIDTH = 400;
const GAME_BASE_HEIGHT = 711;
let globalScale = 1;

let lastTime = 0;
let deltaTime = 0;

const SPEED_MULTIPLIER = 0.80;

let ugolArbuza = 0;
let skorostArbuza = 0.03 * SPEED_MULTIPLIER;
let startNozhY = 0;

let nozh = { x: 200, y: 0, shirina: 40, vysota: 120, letit: false };
let arbuz = { x: 200, y: 0, razmer: 100, bazi_Y: 0 };

let fazaDvizheniya = 0;
let meteor = { aktiven: false, ugol: 0, skorost: 0.04 * SPEED_MULTIPLIER, radiusOtArbuza: 160, razmer: 30 };
let vteknutieNozhi = [];
let yablokiNaArbuze = [];
let bronyaNaArbuze = [];
let oskolki = [];
let tryaskaEkrana = 0;
let uroven = 1;
let nozhiDlyaPobedy = 5;
let ostalosNozhei = 5;
let bronyaProbytaNaUrovne = false;
let vsplyvayushieTeksty = [];
let krasnayaVspyshka = 0;
let padayushiyNozh = null;
let sostoyanieIgry = "MENU";

// Яндекс SDK
let ysdk = null;
let player = null;

// Данные игры
let monety = 0;
let kuplyennyeSkins = ["knife"];
let vybrannyiSkinId = "knife";

// === МАСШТАБИРОВАНИЕ МЕНЮ ===
function scaleMenus() {
    const container = document.getElementById('gameContainer');
    const width = container ? container.clientWidth : window.innerWidth;
    
    const baseMenuWidth = 320;
    let menuScale = 1.0;
    if (width < 350) {
        menuScale = Math.max(0.6, width / baseMenuWidth);
    }
    
    const menus = document.querySelectorAll('.popup-scale-target');
    menus.forEach(menu => {
        if (menu.classList.contains('skryto')) return;
        
        if (menu.classList.contains('popup-overlay')) {
             menu.style.transform = `translate(-50%, -50%) scale(${menuScale})`;
        } else {
            menu.style.transform = `scale(${menuScale})`;
        }
    });
}

// === ОБНОВЛЕНИЕ HUD ===
function updateHUD() {
    if (sostoyanieIgry === "PLAY" || sostoyanieIgry === "GAMEOVER") {
        uiPanelLevel.classList.remove("skryto");
        uiPanelNozhei.classList.remove("skryto");
        
        const eb = (uroven % 5 === 0);
        uiTekstLevel.textContent = (eb ? t("boss") : t("level") + " ") + uroven;
        uiTekstNozhei.textContent = t("knives") + " " + ostalosNozhei;
        
        if (eb) {
            uiTekstLevel.style.color = "#FF4444";
        } else {
            uiTekstLevel.style.color = "#FFFFFF";
        }
    } else {
        uiPanelLevel.classList.add("skryto");
        uiPanelNozhei.classList.add("skryto");
    }
}

// === МАСШТАБИРОВАНИЕ ЭКРАНА ===
function nastroikaEkrana() {
    let winWidth, winHeight;
    
    if (window.visualViewport) {
        winWidth = window.visualViewport.width;
        winHeight = window.visualViewport.height;
    } else {
        winWidth = window.innerWidth;
        winHeight = window.innerHeight;
    }
    
    winWidth = Math.max(0, winWidth - 20);
    winHeight = Math.max(0, winHeight - 20);
    
    const aspectRatio = 9 / 16;
    let finalWidth, finalHeight;
    
    if (winWidth / winHeight > aspectRatio) {
        finalHeight = winHeight;
        finalWidth = finalHeight * aspectRatio;
    } else {
        finalWidth = winWidth;
        finalHeight = finalWidth / aspectRatio;
    }
    
    const container = document.getElementById('gameContainer');
    container.style.width = finalWidth + 'px';
    container.style.height = finalHeight + 'px';
    
    const cssWidth = finalWidth;
    const cssHeight = finalHeight;
    
    const dpr = window.devicePixelRatio || 1;
    holst.width = Math.floor(cssWidth * dpr);
    holst.height = Math.floor(cssHeight * dpr);
    
    kist.setTransform(1, 0, 0, 1, 0, 0);
    kist.scale(dpr, dpr);
    
    // Вычисляем масштаб относительно базовой ширины 400px
    globalScale = cssWidth / GAME_BASE_WIDTH;
    
    // === МАСШТАБИРОВАНИЕ ИНТЕРФЕЙСА (HUD) ===
    // Используем globalScale для изменения размеров шрифтов и отступов
    const uiScale = Math.max(0.5, Math.min(globalScale, 1.2)); 
    
    // Масштабируем текст уровня и ножей
    const hudElements = [uiPanelLevel, uiPanelNozhei];
    hudElements.forEach(el => {
        if (el) {
            const newSize = Math.max(10, 24 * uiScale); 
            el.style.fontSize = newSize + 'px';
            const shadowSize = Math.max(1, 2 * uiScale);
            el.style.textShadow = `${shadowSize}px ${shadowSize}px ${shadowSize * 2}px #000000`;
        }
    });
    
    // Масштабируем панель монет
    if (uiPanelMonet) {
        const newSize = Math.max(12, 18 * uiScale);
        uiPanelMonet.style.fontSize = newSize + 'px';
    }

    startNozhY = 580;
    if (!nozh.letit) {
        nozh.y = startNozhY;
        nozh.x = 200;
    }
    
    arbuz.x = 200;
    arbuz.bazi_Y = 230;
    if (sostoyanieIgry === "MENU" || sostoyanieIgry === "GAMEOVER") {
         arbuz.y = arbuz.bazi_Y;
    }

    // Масштабирование интерфейса (звук и монеты)
    const slider = document.getElementById('panelZvuka');
    if (slider) {
        const scale = Math.min(globalScale, 0.8);
        slider.style.transform = `translate(${15 * scale}px, ${50 * scale}px) scale(${scale})`;
    }

    const monet = document.getElementById('panelMonet');
    if (monet) {
        const scale = Math.min(globalScale, 0.8);
        monet.style.transform = `translate(${-15 * scale}px, ${50 * scale}px) scale(${scale})`;
    }
    
    updateHUD();
    updateUI();
    scaleMenus();
}

function forceResize() {
    requestAnimationFrame(() => {
        nastroikaEkrana();
    });
}

// === ИНИЦИАЛИЗАЦИЯ YANDEX SDK ===
function initYandexSDK() {
    if (typeof YaGames === 'undefined') {
        console.warn('Yandex SDK not loaded, using local mode');
        initLocalEnvironment();
        return;
    }
    
    YaGames.init().then(_sdk => {
        console.log('Yandex SDK initialized');
        ysdk = _sdk;
        
        // Автоопределение языка (Пункт 2.14)
        if (ysdk.environment && ysdk.environment.i18n && ysdk.environment.i18n.lang) {
            currentLang = ysdk.environment.i18n.lang === 'ru' ? 'ru' : 'en';
            console.log('Language detected via SDK:', currentLang);
        } else {
            const bl = navigator.language || navigator.userLanguage;
            currentLang = bl.startsWith('ru') ? 'ru' : 'en';
        }
        
        applyLanguage();
        
        if (ysdk.features && ysdk.features.LoadingAPI) {
            ysdk.features.LoadingAPI.ready();
        }
        
        if (ysdk.on) {
            ysdk.on('game_api_pause', handleGamePause);
            ysdk.on('game_api_resume', handleGameResume);
        }
        
        initPlayer();
        
    }).catch(err => {
        console.error('Yandex SDK init error:', err);
        initLocalEnvironment();
    });
}

function initPlayer() {
    if (!ysdk) return;
    ysdk.getPlayer().then(_player => {
        player = _player;
        loadData();
    }).catch(err => {
        console.warn('Player init error:', err);
        loadData();
    });
}

function initLocalEnvironment() {
    const bl = navigator.language || navigator.userLanguage;
    currentLang = bl.startsWith('ru') ? 'ru' : 'en';
    applyLanguage();
    loadData();
}

// === ОБРАБОТЧИКИ ПАУЗЫ ===
function handleGamePause() {
    if (masterGain) masterGain.gain.value = 0;
    if (sostoyanieIgry === "PLAY") sostoyanieIgry = "PAUSED";
}

function handleGameResume() {
    if (masterGain) masterGain.gain.value = isMuted ? 0 : currentVolume;
    if (sostoyanieIgry === "PAUSED") sostoyanieIgry = "PLAY";
}

// === СОХРАНЕНИЕ/ЗАГРУЗКА ===
function saveData() {
    const data = {
        monety: monety,
        skins: kuplyennyeSkins,
        selectedSkin: vybrannyiSkinId,
        volume: currentVolume,
        muted: isMuted
    };
    
    localStorage.setItem('snaiperMonety', monety);
    localStorage.setItem('snaiperSkins', JSON.stringify(kuplyennyeSkins));
    localStorage.setItem('snaiperVybrannyi', vybrannyiSkinId);
    localStorage.setItem('snaiperVolume', currentVolume);
    localStorage.setItem('snaiperMute', isMuted);
    
    if (player) {
        player.setData(data).catch(err => console.warn('Save error:', err));
    }
}

function loadData() {
    if (player) {
        player.getData().then(data => {
            if (data.monety !== undefined) monety = data.monety;
            if (data.skins) kuplyennyeSkins = data.skins;
            if (data.selectedSkin) vybrannyiSkinId = data.selectedSkin;
            if (data.volume !== undefined) currentVolume = data.volume;
            if (data.muted !== undefined) isMuted = data.muted;
            updateUI();
        }).catch(err => {
            console.warn('Load error:', err);
            loadFromLocalStorage();
        });
    } else {
        loadFromLocalStorage();
    }
}

function loadFromLocalStorage() {
    monety = parseInt(localStorage.getItem('snaiperMonety')) || 0;
    kuplyennyeSkins = JSON.parse(localStorage.getItem('snaiperSkins')) || ["knife"];
    vybrannyiSkinId = localStorage.getItem('snaiperVybrannyi') || "knife";
    currentVolume = parseFloat(localStorage.getItem('snaiperVolume'));
    if (isNaN(currentVolume)) currentVolume = 0.4;
    isMuted = localStorage.getItem('snaiperMute') === 'true';
    updateUI();
}

function updateUI() {
    if (uiMonety) uiMonety.innerText = monety;
    updateVolumeUI();
}

// === АУДИО ===
let audioContext = null;
let masterGain = null;
let isAudioUnlocked = false;

function initAudio() {
    if (audioContext) return true;
    try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return false;
        audioContext = new AudioCtx();
        masterGain = audioContext.createGain();
        masterGain.gain.value = isMuted ? 0 : currentVolume;
        masterGain.connect(audioContext.destination);
        return true;
    } catch(e) { return false; }
}

function unlockAudio() {
    if (isAudioUnlocked) return;
    if (initAudio() && audioContext.state === 'suspended') {
        audioContext.resume().then(() => { isAudioUnlocked = true; }).catch(() => {});
    }
    isAudioUnlocked = true;
}

document.addEventListener('click', unlockAudio, { once: true, passive: true });
document.addEventListener('touchstart', unlockAudio, { once: true, passive: true });
document.addEventListener('keydown', unlockAudio, { once: true, passive: true });

const audioBuffers = {};
const audioFileList = { throw: "throw.mp3", fail: "fail.mp3", apple: "apple.mp3", win: "win.mp3", chest: "chest.mp3" };

function loadAudioFiles() {
    if (!initAudio()) return;
    Object.entries(audioFileList).forEach(([key, url]) => {
        fetch(url).then(res => res.ok ? res.arrayBuffer() : Promise.reject(new Error('404')))
            .then(buf => audioContext.decodeAudioData(buf))
            .then(dec => { audioBuffers[key] = dec; })
            .catch(() => {});
    });
}

function playSnd(sndName) {
    if (isMuted || currentVolume === 0 || !audioContext || !audioBuffers[sndName]) return;
    try {
        const src = audioContext.createBufferSource();
        src.buffer = audioBuffers[sndName];
        const gn = audioContext.createGain();
        gn.gain.value = currentVolume;
        src.connect(gn); gn.connect(masterGain);
        src.start(0);
    } catch(e) {}
}

function updateVolumeUI() {
    const v = isMuted ? 0 : currentVolume;
    if (masterGain) masterGain.gain.value = v;
    if (knopkaZvuka) knopkaZvuka.innerText = v === 0 ? "🔇" : "🔊";
    if (polzunokZvuka) polzunokZvuka.value = v;
}

let currentVolume = 0.4;
let isMuted = false;

if (polzunokZvuka) {
    polzunokZvuka.addEventListener('input', function(e) {
        currentVolume = parseFloat(e.target.value);
        isMuted = currentVolume === 0;
        saveData();
        updateVolumeUI();
    });
}

if (knopkaZvuka) {
    knopkaZvuka.onclick = function() {
        isMuted = !isMuted;
        if (!isMuted && currentVolume === 0) currentVolume = 0.4;
        saveData();
        updateVolumeUI();
    };
}

function muteForAd() { if (masterGain) masterGain.gain.value = 0; }
function unmuteAfterAd() { if (masterGain) masterGain.gain.value = isMuted ? 0 : currentVolume; }

// === ЛОКАЛИЗАЦИЯ ===
let currentLang = 'ru'; 
const i18n = {
    ru: { 
        title: "ФРУКТОВЫЙ СНАЙПЕР", 
        play: "ИГРАТЬ", 
        shop: "МАГАЗИН СКИНОВ", 
        armory: "ОРУЖЕЙНАЯ", 
        chest: "СУНДУК УДАЧИ", 
        chance: "Шанс на Легендарку: 5%", 
        open: "ОТКРЫТЬ", 
        back: "НАЗАД В МЕНЮ", 
        reward: "НАГРАДА!", 
        claim: "ЗАБРАТЬ", 
        gameover: "ПРОИГРАЛ!", 
        level: "Уровень:", 
        continue: "ПРОДОЛЖИТЬ", 
        restart: "НАЧАТЬ ЗАНОВО", 
        boss: "БОСС!", 
        knives: "Ножей:", 
        equipped: "В РУКАХ", 
        equip: "ВЗЯТЬ", 
        legendaryReward: "КЛИНОК КОСМОСА!",
        // Названия ножей
        knife: "Нож",
        pencil: "Карандаш",
        sword: "Меч",
        shuriken: "Сюрикен",
        axe: "Топор",
        wand: "Посох",
        legendary: "Легендарный Клинок"
    },
    en: { 
        title: "FRUIT SNIPER", 
        play: "PLAY", 
        shop: "SKINS SHOP", 
        armory: "ARMORY", 
        chest: "LUCKY CHEST", 
        chance: "Legendary Chance: 5%", 
        open: "OPEN", 
        back: "BACK TO MENU", 
        reward: "REWARD!", 
        claim: "CLAIM", 
        gameover: "GAME OVER!", 
        level: "Level:", 
        continue: "CONTINUE", 
        restart: "RESTART", 
        boss: "BOSS!", 
        knives: "Knives:", 
        equipped: "EQUIPPED", 
        equip: "EQUIP", 
        legendaryReward: "COSMIC BLADE!",
        // Названия ножей
        knife: "Knife",
        pencil: "Pencil",
        sword: "Sword",
        shuriken: "Shuriken",
        axe: "Axe",
        wand: "Wand",
        legendary: "Legendary Blade"
    }
};

function t(key) { return i18n[currentLang]?.[key] || i18n.ru[key] || key; }

function applyLanguage() {
    const el = (id) => document.getElementById(id);
    if (el("knopkaIgrat")) el("knopkaIgrat").innerText = t("play");
    if (el("knopkaMagazin")) el("knopkaMagazin").innerText = t("shop");
    if (el("ui_armory")) el("ui_armory").innerText = t("armory");
    if (el("ui_chest")) el("ui_chest").innerText = t("chest");
    if (el("ui_chance")) el("ui_chance").innerText = t("chance");
    if (el("knopkaSunduk")) el("knopkaSunduk").innerText = t("open") + " (30 🍎)";
    if (el("knopkaNazadIzMagazina")) el("knopkaNazadIzMagazina").innerText = t("back");
    if (el("ui_reward")) el("ui_reward").innerText = t("reward");
    if (el("ui_claim")) el("ui_claim").innerText = t("claim");
    if (el("ui_gameover")) el("ui_gameover").innerText = t("gameover");
    if (el("ui_lvl_text")) el("ui_lvl_text").innerText = t("level");
    if (el("knopkaVoskresheniya")) el("knopkaVoskresheniya").innerHTML = `<span class="btn-icon">🎬</span><span class="btn-text">${t("continue")}<br><small>ЗА ВИДЕО</small></span>`;
    if (el("knopkaZanovo")) el("knopkaZanovo").innerText = t("restart");
    updateHUD();
}

window.switchLang = function(lang) {
    currentLang = lang;
    applyLanguage();
};

// === ИГРОВАЯ ЛОГИКА ===

const vseSkins = [
    { id: "knife", price: 0, file: "knife.png", speed: 35 * SPEED_MULTIPLIER, appleHitbox: 0.55, coinMult: 1, slow: 1, pierce: false, isGacha: false },
    { id: "pencil", price: 10, file: "pencil.png", speed: 55 * SPEED_MULTIPLIER, appleHitbox: 0.55, coinMult: 1, slow: 1, pierce: false, isGacha: false },
    { id: "sword", price: 25, file: "sword.png", speed: 35 * SPEED_MULTIPLIER, appleHitbox: 0.9, coinMult: 1, slow: 1, pierce: false, isGacha: false },
    { id: "shuriken", price: 45, file: "shuriken.png", speed: 35 * SPEED_MULTIPLIER, appleHitbox: 0.55, coinMult: 2, slow: 1, pierce: false, isGacha: false },
    { id: "axe", price: 70, file: "axe.png", speed: 35 * SPEED_MULTIPLIER, appleHitbox: 0.55, coinMult: 1, slow: 1, pierce: true, isGacha: false },
    { id: "wand", price: 100, file: "wand.png", speed: 35 * SPEED_MULTIPLIER, appleHitbox: 0.55, coinMult: 1, slow: 0.8, pierce: false, isGacha: false },
    { id: "legendary", price: 999, file: "legendary.png", speed: 60 * SPEED_MULTIPLIER, appleHitbox: 1.0, coinMult: 3, slow: 0.5, pierce: true, isGacha: true }
];

function poluchitStatiSkina() { return vseSkins.find(s => s.id === vybrannyiSkinId) || vseSkins[0]; }

// Загрузка изображений
const kartinkaYabloko = new Image(); kartinkaYabloko.src = "apple.png";
const kartinkaBronya = new Image(); kartinkaBronya.src = "spike.png";
const kartinkaMeteor = new Image(); kartinkaMeteor.src = "meteor.png";
const kartinkaSunduk = new Image(); kartinkaSunduk.src = "chest.png";
const kartinkaArbuz = new Image(); kartinkaArbuz.src = "target.png";
const kartinkaBoss = new Image(); kartinkaBoss.src = "boss.png";
const kartinkaPizza = new Image(); kartinkaPizza.src = "pizza.png";
const kartinkaBurger = new Image(); kartinkaBurger.src = "burger.png";
const kartinkaStump = new Image(); kartinkaStump.src = "stump.png";
const kartinkaGolem = new Image(); kartinkaGolem.src = "golem.png";

const kartinkiOruzhiya = {};
let vsegoKartinok = 10 + vseSkins.length;
let zagruzhenoKartinok = 0;

function proverkaZagr() {
    zagruzhenoKartinok++;
    if (zagruzhenoKartinok === vsegoKartinok) {
        nastroikaEkrana();
        lastTime = performance.now();
        igrovoiCikl(lastTime);
    }
}

kartinkaYabloko.onload = proverkaZagr;
kartinkaBronya.onload = proverkaZagr;
kartinkaMeteor.onload = proverkaZagr;
kartinkaSunduk.onload = proverkaZagr;
kartinkaArbuz.onload = proverkaZagr;
kartinkaBoss.onload = proverkaZagr;
kartinkaPizza.onload = proverkaZagr;
kartinkaBurger.onload = proverkaZagr;
kartinkaStump.onload = proverkaZagr;
kartinkaGolem.onload = proverkaZagr;

vseSkins.forEach(s => {
    const i = new Image();
    i.src = s.file;
    i.onload = proverkaZagr;
    i.onerror = () => console.warn(`Нет ${s.file}`);
    kartinkiOruzhiya[s.id] = i;
});

// === ОБРАБОТЧИКИ КНОПОК ===
if (knopkaIgrat) {
    knopkaIgrat.onclick = function() {
        unlockAudio();
        sbrosIgry();
    };
}

if (knopkaMagazin) {
    knopkaMagazin.onclick = function() {
        if(uiGlavnoeMenu) uiGlavnoeMenu.classList.add("skryto");
        if(uiEkranMagazina) uiEkranMagazina.classList.remove("skryto");
        otrisovatMagazin();
    };
}

if (knopkaNazadIzMagazina) {
    knopkaNazadIzMagazina.onclick = function() {
        if(uiEkranMagazina) uiEkranMagazina.classList.add("skryto");
        if(uiGlavnoeMenu) uiGlavnoeMenu.classList.remove("skryto");
    };
}

function dobavitMonety(k) {
    monety += k;
    updateUI(); // МГНОВЕННОЕ ОБНОВЛЕНИЕ СЧЕТЧИКА
    saveData();
    if(sostoyanieIgry==="MENU") {
        otrisovatMagazin();
        const b = document.getElementById("knopkaSunduk");
        if(b) b.disabled = monety < 30;
    }
}

window.otkrytSunduk = function() {
    const b = document.getElementById("knopkaSunduk");
    if (monety < 30 || (b && b.disabled)) return;
    
    if(b) b.disabled = true;
    dobavitMonety(-30);
    playSnd("chest");
    
    const c = document.getElementById("kartinkaSunduka");
    if(c) c.classList.add("chest-opening");
    
    setTimeout(() => {
        if(c) c.classList.remove("chest-opening");
        const sh = Math.random();
        let nag = "";
        let leg = false;
        
        if(sh <= 0.05 && !kuplyennyeSkins.includes("legendary")) {
            kuplyennyeSkins.push("legendary");
            saveData();
            nag = t("legendaryReward");
            const tx = document.getElementById("tekstNagrady");
            if(tx) tx.style.color = "#FFD700";
            leg = true;
        } else {
            const r = Math.random();
            let k = 0;
            if(r < 0.35) k = 10;
            else if(r < 0.75) k = 20;
            else if(r < 0.90) k = 30;
            else if(r < 0.97) k = 40;
            else k = 50;
            
            dobavitMonety(k);
            nag = "+" + k + " 🍎";
            const tx = document.getElementById("tekstNagrady");
            if(tx) tx.style.color = "white";
        }
        
        playSnd("win");
        const tx = document.getElementById("tekstNagrady");
        if(tx) tx.innerText = nag;
        const pp = document.getElementById("popupNagrada");
        if(pp) pp.classList.remove("skryto");
    }, 800);
};

window.zakrytPopup = function() {
    const p = document.getElementById("popupNagrada");
    if(p) p.classList.add("skryto");
    otrisovatMagazin();
};

window.kupitSkin = function(id) {
    const s = vseSkins.find(x => x.id === id);
    if(!s) return;
    if(monety >= s.price && !kuplyennyeSkins.includes(id)) {
        dobavitMonety(-s.price);
        kuplyennyeSkins.push(id);
        saveData();
        playSnd("apple");
        window.vybratSkin(id);
    }
};

window.vybratSkin = function(id) {
    if(kuplyennyeSkins.includes(id)) {
        vybrannyiSkinId = id;
        saveData();
        otrisovatMagazin();
    }
};

// === ОТРИСОВКА МАГАЗИНА (С ЛОКАЛИЗАЦИЕЙ) ===
function otrisovatMagazin() {
    if(!uiSetkaSkinov) return;
    let h = "";
    vseSkins.forEach(s => {
        if(s.isGacha && !kuplyennyeSkins.includes(s.id)) return;
        const ok = kuplyennyeSkins.includes(s.id);
        const eq = (vybrannyiSkinId === s.id);
        let bh = "";
        
        if(eq) {
            bh = `<button class="MknopkaVybrano" disabled>${t("equipped")}</button>`;
        } else if(ok) {
            bh = `<button class="MknopkaVybrat" onclick="vybratSkin('${s.id}')">${t("equip")}</button>`;
        } else {
            const can = monety >= s.price;
            bh = `<button class="${can ? "MknopkaKupit" : "MknopkaKupit serya"}" onclick="kupitSkin('${s.id}')" ${!can ? "disabled" : ""}>${s.price} 🍎</button>`;
        }
        
        // === ЛОКАЛИЗОВАННЫЕ НАЗВАНИЯ НОЖЕЙ ===
        const skinName = t(s.id); // Берем локализованное название из i18n
        
        // === ИСПРАВЛЕННОЕ ОПИСАНИЕ ДЛЯ КАЖДОГО НОЖА ===
        let desc = "";
        if(s.id === "knife") {
            desc = currentLang === 'ru' ? "Стандартный нож" : "Standard knife";
        } else if(s.id === "pencil") {
            desc = currentLang === 'ru' ? "Летит очень быстро" : "Flies very fast";
        } else if(s.id === "sword") {
            desc = currentLang === 'ru' ? "Увеличенный сбор яблок" : "Increased apple collection";
        } else if(s.id === "shuriken") {
            desc = currentLang === 'ru' ? "x" + s.coinMult + " монет за яблоко" : "x" + s.coinMult + " coins per apple";
        } else if(s.id === "axe") {
            desc = currentLang === 'ru' ? "Пробивает 1 шип" : "Pierces 1 spike";
        } else if(s.id === "wand") {
            desc = currentLang === 'ru' ? "Замедляет время" : "Slows down time";
        } else if(s.id === "legendary") {
            desc = currentLang === 'ru' ? "x" + s.coinMult + " монет, пробитие и замедление" : "x" + s.coinMult + " coins, pierce & slow";
        } else {
            desc = currentLang === 'ru' ? "Обычный" : "Common";
        }
        
        h += `<div class="${s.isGacha ? "kartochkaSkina legendary" : "kartochkaSkina"}">
            <img src="${s.file}" alt="${skinName}">
            <div class="nazvanieSkina">${skinName}</div>
            <div class="opisanieSkina">${desc}</div>
            ${bh}
        </div>`;
    });
    uiSetkaSkinov.innerHTML = h;
    
    const b = document.getElementById("knopkaSunduk");
    if(b) {
        b.disabled = monety < 30;
        b.innerText = t("open") + " (30 🍎)";
    }
}

if (knopkaZanovo) {
    knopkaZanovo.onclick = function() {
        vozvratVMenyu();
    };
}

if (knopkaVoskresheniya) {
    knopkaVoskresheniya.onclick = function() {
        if (ysdk && ysdk.adv) {
            ysdk.adv.showRewardedVideo({
                callbacks: {
                    onOpen: muteForAd,
                    onRewarded: () => {
                        voskresitIgryoka();
                    },
                    onClose: () => {
                        unmuteAfterAd();
                    },
                    onError: () => {
                        unmuteAfterAd();
                    }
                }
            }).catch(() => {});
        } else {
            voskresitIgryoka();
        }
    };
}

function voskresitIgryoka() {
    if(uiEkranProigrysha) uiEkranProigrysha.classList.add("skryto");
    nozh.y = startNozhY;
    nozh.letit = false;
    sostoyanieIgry = "PLAY";
    padayushiyNozh = null;
    krasnayaVspyshka = 0;
    updateHUD();
}

function vozvratVMenyu() {
    sostoyanieIgry = "MENU";
    if(uiEkranProigrysha) uiEkranProigrysha.classList.add("skryto");
    if(uiGlavnoeMenu) uiGlavnoeMenu.classList.remove("skryto");
    if(uiPanelMonet) uiPanelMonet.classList.remove("skryto"); // ПОКАЗЫВАЕМ ПАНЕЛЬ МОНЕТ В МЕНЮ
    vteknutieNozhi = [];
    yablokiNaArbuze = [];
    bronyaNaArbuze = [];
    oskolki = [];
    nozh.letit = false;
    nozh.y = startNozhY;
    padayushiyNozh = null;
    updateHUD();
}

function sdelatBrosok() {
    if(sostoyanieIgry === "PLAY" && !nozh.letit && ostalosNozhei > 0) {
        nozh.letit = true;
        playSnd("throw");
    }
}

function handleInput(e) {
    const t = e.target;
    if(t.id === "polzunokZvuka" || t.id === "knopkaZvuka" || t.closest('.knopka') || t.closest('#panelZvuka')) return;
    if(e.type === 'touchstart' || e.type === 'mousedown') {
        e.preventDefault();
        sdelatBrosok();
    }
}

if(holst) {
    holst.addEventListener("mousedown", handleInput);
    holst.addEventListener("touchstart", handleInput, {passive: false});
}

window.addEventListener("keydown", function(e) {
    if(e.code === "Space" || e.code === "KeyW" || e.code === "ArrowUp") {
        if(e.code === "Space") e.preventDefault();
        sdelatBrosok();
    }
});

// === ИГРОВОЙ ЦИКЛ ===
function sbrosIgry() {
    uroven = 1;
    nozhiDlyaPobedy = 5;
    ostalosNozhei = 5;
    vteknutieNozhi = [];
    oskolki = [];
    vsplyvayushieTeksty = [];
    skorostArbuza = 0.03 * SPEED_MULTIPLIER;
    tryaskaEkrana = 0;
    krasnayaVspyshka = 0;
    padayushiyNozh = null;
    nozh.y = startNozhY;
    nozh.letit = false;
    fazaDvizheniya = 0;
    if(arbuz) arbuz.y = arbuz.bazi_Y;
    meteor.aktiven = false;
    meteor.skorost = 0.04 * SPEED_MULTIPLIER;
    sostoyanieIgry = "PLAY";
    if(uiGlavnoeMenu) uiGlavnoeMenu.classList.add("skryto");
    // ИСПРАВЛЕНИЕ: НЕ СКРЫВАЕМ ПАНЕЛЬ МОНЕТ В ИГРЕ
    // if(uiPanelMonet) uiPanelMonet.classList.add("skryto"); <-- УДАЛЕНО
    
    sozdatYablokiIBronyu();
    updateHUD();
    updateUI();
}

function sozdatYablokiIBronyu() {
    yablokiNaArbuze = [];
    bronyaNaArbuze = [];
    bronyaProbytaNaUrovne = false;
    let ky = Math.floor(Math.random() * 3);
    for(let i = 0; i < ky; i++) {
        let p = 0, u;
        do {
            u = Math.random() * Math.PI * 2;
            p++;
        } while(!bezopasnyUgol(u, yablokiNaArbuze, 0.65) && p < 50);
        yablokiNaArbuze.push(u);
    }
    if(uroven >= 3) {
        let kb = 1 + Math.floor(uroven / 5);
        if(kb > 3) kb = 3;
        for(let j = 0; j < kb; j++) {
            let p = 0, u;
            let z = yablokiNaArbuze.concat(bronyaNaArbuze);
            do {
                u = Math.random() * Math.PI * 2;
                p++;
            } while(!bezopasnyUgol(u, z, 0.65) && p < 50);
            bronyaNaArbuze.push(u);
        }
    }
}

function bezopasnyUgol(nu, mz, md) {
    for(let i = 0; i < mz.length; i++) {
        let r = Math.abs(nu - mz[i]) % (Math.PI * 2);
        if(r > Math.PI) r = (Math.PI * 2) - r;
        if(r < md) return false;
    }
    return true;
}

function sleduyushiyUroven() {
    playSnd("win");
    tryaskaEkrana = 15;
    const cv = ["#ff3333", "#cc0000", "#ff6666", "#2eb82e", "#000", "#d4a373"];
    for(let i = 0; i < 80; i++) {
        const es = Math.random() > 0.85;
        oskolki.push({
            x: 200, y: arbuz.y,
            vx: (Math.random() - 0.5) * 25,
            vy: (Math.random() - 0.5) * 25 - 5,
            razmer: es ? 3 : Math.random() * 8 + 3,
            cvet: es ? "#000" : cv[Math.floor(Math.random() * cv.length)],
            zhizn: 1,
            skorostIscheznoveniya: Math.random() * 0.02 + 0.01
        });
    }
    uroven++;
    const eb = (uroven % 5 === 0);
    let bn = 5 + Math.floor(uroven / 3);
    if(eb) bn += 1;
    if(bn > 7) bn = 7;
    nozhiDlyaPobedy = bn;
    ostalosNozhei = bn;
    vteknutieNozhi = [];
    sozdatYablokiIBronyu();
    let ns = 0.03 + (uroven * 0.002);
    if(ns > 0.07) ns = 0.07;
    skorostArbuza = ns * SPEED_MULTIPLIER * (Math.random() > 0.5 ? 1 : -1);
    if(uroven >= 8) {
        meteor.aktiven = true;
        meteor.skorost = (0.03 + Math.random() * 0.04) * SPEED_MULTIPLIER;
        if(Math.random() > 0.5) meteor.skorost *= -1;
    } else {
        meteor.aktiven = false;
    }
    updateHUD();
}

function poluchitKartinkuMisheni() {
    const eb = (uroven % 5 === 0);
    const ep = Math.ceil(uroven / 5) % 3;
    if(ep === 1) return eb ? kartinkaBoss : kartinkaArbuz;
    if(ep === 2) return eb ? kartinkaBurger : kartinkaPizza;
    return eb ? kartinkaGolem : kartinkaStump;
}

function igrovoiCikl(currentTime) {
    deltaTime = (currentTime - lastTime) / 1000;
    lastTime = currentTime;
    
    if (deltaTime > 0.1) deltaTime = 0.1;
    
    requestAnimationFrame(igrovoiCikl);
    
    const dpr = window.devicePixelRatio || 1;
    const cssWidth = holst.width / dpr;
    const cssHeight = holst.height / dpr;
    
    kist.clearRect(0, 0, holst.width, holst.height);
    kist.save();
    kist.scale(globalScale, globalScale);
    
    if(tryaskaEkrana > 0) {
        kist.translate((Math.random() - 0.5) * tryaskaEkrana, (Math.random() - 0.5) * tryaskaEkrana);
        tryaskaEkrana -= 0.5;
    }
    
    const eb = (uroven % 5 === 0);
    const ss = poluchitStatiSkina();
    let tr = arbuz.razmer;
    let mx = 0, my = 0;
    
    if(meteor.aktiven && (sostoyanieIgry === "PLAY" || sostoyanieIgry === "GAMEOVER")) {
        meteor.ugol += meteor.skorost * deltaTime * 60;
        mx = arbuz.x + Math.cos(meteor.ugol) * meteor.radiusOtArbuza;
        my = arbuz.y + Math.sin(meteor.ugol) * meteor.radiusOtArbuza;
    }
    
    if(sostoyanieIgry === "PLAY") {
        if(uroven >= 6) {
            fazaDvizheniya += (0.04 + (uroven * 0.001)) * deltaTime * 60;
            arbuz.y = arbuz.bazi_Y + Math.sin(fazaDvizheniya) * 30;
            if(uroven >= 11) tr = arbuz.razmer + Math.sin(fazaDvizheniya * 2.5) * 15;
        } else {
            arbuz.y = arbuz.bazi_Y;
        }
        
        if(nozh.letit) {
            nozh.y -= ss.speed * deltaTime * 60;
            
            if(meteor.aktiven) {
                const dx = nozh.x - mx, dy = nozh.y - my;
                const d = Math.sqrt(dx * dx + dy * dy);
                if(d < meteor.razmer + nozh.shirina / 2) {
                    playSnd("fail");
                    nozh.letit = false;
                    sostoyanieIgry = "GAMEOVER";
                    tryaskaEkrana = 25;
                    krasnayaVspyshka = 0.8;
                    for(let s = 0; s < 30; s++) {
                        oskolki.push({
                            x: mx, y: my,
                            vx: (Math.random() - 0.5) * 20,
                            vy: (Math.random() - 0.5) * 20,
                            razmer: Math.random() * 5 + 2,
                            cvet: "#FFA500",
                            zhizn: 1,
                            skorostIscheznoveniya: Math.random() * 0.02 + 0.01
                        });
                    }
                    padayushiyNozh = {
                        x: nozh.x, y: nozh.y,
                        vx: (Math.random() > 0.5 ? 6 : -6),
                        vy: -10,
                        ugol: 0,
                        vrashenie: 0.4
                    };
                    nozh.y = 9999;
                    if(uiTekushiyUroven) uiTekushiyUroven.innerText = uroven;
                    if(uiEkranProigrysha) uiEkranProigrysha.classList.remove("skryto");
                    updateHUD();
                }
            }
            
            if(nozh.letit && nozh.y <= arbuz.y + tr) {
                nozh.letit = false;
                const uz = -ugolArbuza;
                let pn = false, pb = false, ib = -1;
                
                for(let i = 0; i < vteknutieNozhi.length; i++) {
                    let r = Math.abs(uz - vteknutieNozhi[i]) % (Math.PI * 2);
                    if(r > Math.PI) r = (Math.PI * 2) - r;
                    if(r < 0.35) { pn = true; break; }
                }
                
                for(let k = 0; k < bronyaNaArbuze.length; k++) {
                    let r = Math.abs(uz - bronyaNaArbuze[k]) % (Math.PI * 2);
                    if(r > Math.PI) r = (Math.PI * 2) - r;
                    if(r < 0.45) { pb = true; ib = k; break; }
                }
                
                if(pb && ss.pierce && !bronyaProbytaNaUrovne) {
                    bronyaNaArbuze.splice(ib, 1);
                    bronyaProbytaNaUrovne = true;
                    pb = false;
                    for(let s = 0; s < 20; s++) {
                        oskolki.push({
                            x: nozh.x, y: nozh.y - 20,
                            vx: (Math.random() - 0.5) * 15,
                            vy: (Math.random() - 0.5) * 15 - 5,
                            razmer: Math.random() * 5 + 3,
                            cvet: "#888",
                            zhizn: 1,
                            skorostIscheznoveniya: Math.random() * 0.02 + 0.01
                        });
                    }
                    nozh.y = startNozhY;
                    tryaskaEkrana = 8;
                } else if(pn || pb) {
                    playSnd("fail");
                    sostoyanieIgry = "GAMEOVER";
                    tryaskaEkrana = 20;
                    krasnayaVspyshka = 0.6;
                    for(let s = 0; s < 25; s++) {
                        oskolki.push({
                            x: 200, y: arbuz.y + tr,
                            vx: (Math.random() - 0.5) * 20,
                            vy: (Math.random() - 0.5) * 20,
                            razmer: Math.random() * 4 + 2,
                            cvet: "#FFF",
                            zhizn: 1,
                            skorostIscheznoveniya: Math.random() * 0.02 + 0.01
                        });
                    }
                    padayushiyNozh = {
                        x: nozh.x, y: arbuz.y + tr,
                        vx: (Math.random() > 0.5 ? 5 : -5),
                        vy: -15,
                        ugol: 0,
                        vrashenie: 0.3
                    };
                    nozh.y = 9999;
                    if(uiTekushiyUroven) uiTekushiyUroven.innerText = uroven;
                    if(uiEkranProigrysha) uiEkranProigrysha.classList.remove("skryto");
                    updateHUD();
                } else {
                    for(let j = 0; j < yablokiNaArbuze.length; j++) {
                        let r = Math.abs(uz - yablokiNaArbuze[j]) % (Math.PI * 2);
                        if(r > Math.PI) r = (Math.PI * 2) - r;
                        if(r < ss.appleHitbox) {
                            playSnd("apple");
                            yablokiNaArbuze.splice(j, 1);
                            const ng = 1 * ss.coinMult;
                            dobavitMonety(ng);
                            for(let s = 0; s < 15; s++) {
                                oskolki.push({
                                    x: 200, y: arbuz.y + tr,
                                    vx: (Math.random() - 0.5) * 10,
                                    vy: (Math.random() - 0.5) * 10,
                                    razmer: Math.random() * 4 + 2,
                                    cvet: "#FFD700",
                                    zhizn: 1,
                                    skorostIscheznoveniya: Math.random() * 0.02 + 0.01
                                });
                            }
                            vsplyvayushieTeksty.push({
                                text: "+" + ng,
                                x: 200 + (Math.random() - 0.5) * 30,
                                y: arbuz.y + tr,
                                vy: -2,
                                zhizn: 1
                            });
                            break;
                        }
                    }
                    vteknutieNozhi.push(uz);
                    ostalosNozhei--;
                    if(ostalosNozhei <= 0) sleduyushiyUroven();
                    nozh.y = startNozhY;
                    updateHUD();
                }
            }
        }
        
        if(eb && Math.random() < 0.008) skorostArbuza = -skorostArbuza;
        ugolArbuza += skorostArbuza * ss.slow * deltaTime * 60;
    }
    
    // Отрисовка осколков
    for(let i = oskolki.length - 1; i >= 0; i--) {
        let o = oskolki[i];
        o.x += o.vx * deltaTime * 60;
        o.y += o.vy * deltaTime * 60;
        o.vy += 0.8 * deltaTime * 60;
        o.zhizn -= o.skorostIscheznoveniya * deltaTime * 60;
        if(o.zhizn > 0) {
            kist.globalAlpha = Math.max(0, o.zhizn);
            kist.fillStyle = o.cvet;
            kist.beginPath();
            kist.arc(o.x, o.y, o.razmer, 0, Math.PI * 2);
            kist.fill();
            kist.globalAlpha = 1;
        } else {
            oskolki.splice(i, 1);
        }
    }
    
    const an = kartinkiOruzhiya[vybrannyiSkinId];
    const am = poluchitKartinkuMisheni();
    
    if(meteor.aktiven) {
        kist.save();
        kist.translate(mx, my);
        kist.rotate(meteor.ugol * 3);
        kist.drawImage(kartinkaMeteor, -meteor.razmer, -meteor.razmer, meteor.razmer * 2, meteor.razmer * 2);
        kist.restore();
    }
    
    kist.save();
    kist.translate(arbuz.x, arbuz.y);
    kist.rotate(ugolArbuza);
    
    for(let i = 0; i < vteknutieNozhi.length; i++) {
        kist.save();
        kist.rotate(vteknutieNozhi[i]);
        if(an) kist.drawImage(an, -nozh.shirina / 2, tr - 30, nozh.shirina, nozh.vysota);
        kist.restore();
    }
    
    if(am) kist.drawImage(am, -tr, -tr, tr * 2, tr * 2);
    
    for(let i = 0; i < yablokiNaArbuze.length; i++) {
        kist.save();
        kist.rotate(yablokiNaArbuze[i]);
        kist.translate(0, tr + 30);
        kist.rotate(Math.PI);
        kist.drawImage(kartinkaYabloko, -50, -50, 100, 100);
        kist.restore();
    }
    
    for(let i = 0; i < bronyaNaArbuze.length; i++) {
        kist.save();
        kist.rotate(bronyaNaArbuze[i]);
        kist.translate(0, tr + 20);
        kist.rotate(Math.PI);
        kist.drawImage(kartinkaBronya, -25, -25, 50, 50);
        kist.restore();
    }
    
    kist.restore();
    
    if((sostoyanieIgry === "PLAY" || sostoyanieIgry === "GAMEOVER") && ostalosNozhei > 0 && padayushiyNozh === null && an) {
        kist.drawImage(an, nozh.x - nozh.shirina / 2, nozh.y, nozh.shirina, nozh.vysota);
    }
    
    if(padayushiyNozh && an) {
        padayushiyNozh.vy += 0.8 * deltaTime * 60;
        padayushiyNozh.x += padayushiyNozh.vx * deltaTime * 60;
        padayushiyNozh.y += padayushiyNozh.vy * deltaTime * 60;
        padayushiyNozh.ugol += padayushiyNozh.vrashenie * deltaTime * 60;
        kist.save();
        kist.translate(padayushiyNozh.x, padayushiyNozh.y);
        kist.rotate(padayushiyNozh.ugol);
        kist.drawImage(an, -nozh.shirina / 2, -nozh.vysota / 2, nozh.shirina, nozh.vysota);
        kist.restore();
    }
    
    // Всплывающий текст
    for(let i = vsplyvayushieTeksty.length - 1; i >= 0; i--) {
        let v = vsplyvayushieTeksty[i];
        v.y += v.vy * deltaTime * 60;
        v.zhizn -= 0.02 * deltaTime * 60;
        if(v.zhizn > 0) {
            kist.globalAlpha = Math.max(0, v.zhizn);
            kist.fillStyle = "#FFD700";
            kist.font = "bold 40px Arial";
            kist.textAlign = "center";
            kist.fillText(v.text, v.x, v.y);
            kist.globalAlpha = 1;
        } else {
            vsplyvayushieTeksty.splice(i, 1);
        }
    }
    
    kist.restore();
    
    if(krasnayaVspyshka > 0) {
        kist.fillStyle = `rgba(255,0,0,${krasnayaVspyshka})`;
        kist.fillRect(0, 0, holst.width, holst.height);
        krasnayaVspyshka -= 0.02 * deltaTime * 60;
    }
}

// === ЗАПУСК ===
window.addEventListener("resize", forceResize);
window.addEventListener("orientationchange", () => {
    setTimeout(forceResize, 100);
});

if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', forceResize);
    window.visualViewport.addEventListener('scroll', forceResize);
}

window.addEventListener("load", () => {
    setTimeout(forceResize, 100);
    setTimeout(forceResize, 500);
    setTimeout(forceResize, 1000);
    // Инициализация SDK после загрузки
    initYandexSDK();
    loadAudioFiles();
});

// Инициализация при старте
nastroikaEkrana();