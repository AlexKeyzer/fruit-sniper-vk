(function() {
    'use strict';

    function isInsideVk() {
        try {
            var params = new URLSearchParams(window.location.search);
            if (params.has('vk_app_id') || params.has('vk_user_id')) return true;
            var ref = document.referrer || '';
            if (ref.indexOf('vk.com') !== -1 || ref.indexOf('vk.ru') !== -1) return true;
            var ua = navigator.userAgent || '';
            if (ua.indexOf('VK') !== -1 || ua.indexOf('VKontakte') !== -1) return true;
            if (window.parent !== window) return true;
            return false;
        } catch (e) {
            return false;
        }
    }

    function loadVkBridge(callback) {
        var urls = [
            'https://unpkg.com/@vkontakte/vk-bridge/dist/browser.min.js',
            'https://cdn.jsdelivr.net/npm/@vkontakte/vk-bridge/dist/browser.min.js'
        ];
        var idx = 0;
        var done = false;

        function tryNext() {
            if (done) return;
            if (idx >= urls.length) {
                done = true;
                callback(null);
                return;
            }

            var s = document.createElement('script');
            s.src = urls[idx];
            s.async = true;

            var to = setTimeout(function() {
                s.onload = null;
                s.onerror = null;
                idx++;
                tryNext();
            }, 4000);

            s.onload = function() {
                clearTimeout(to);
                if (!done) {
                    done = true;
                    callback((typeof vkBridge !== 'undefined' && vkBridge) ? vkBridge : null);
                }
            };

            s.onerror = function() {
                clearTimeout(to);
                idx++;
                tryNext();
            };

            document.head.appendChild(s);
        }

        tryNext();
    }

    function adLog(msg) {
        console.log('[AD]', msg);
    }

    var PlatformAdapter = {
        platform: 'web',
        vkBridge: null,
        sessionStartTime: Date.now(),
        lastInterstitialTime: 0,
        userId: null,

        init: function() {
            var self = this;
            return new Promise(function(resolve) {
                if (self.vkBridge && typeof self.vkBridge.send === 'function') {
                    self.platform = 'vk';
                    self.vkBridge.send('VKWebAppInit').then(function() {
                        adLog('VKWebAppInit OK');
                        return self.vkBridge.send('VKWebAppGetUserInfo');
                    }).then(function(user) {
                        if (user) self.userId = user.id;
                        if (self.vkBridge.subscribe) {
                            try {
                                self.vkBridge.subscribe(function(event) {
                                    if (event.detail && event.detail.type === 'VKWebAppViewHide') {
                                        pauseGameForAd();
                                    }
                                });
                            } catch (e) {}
                        }
                        resolve();
                    }).catch(function(e) {
                        adLog('Init warning: ' + (e && e.message ? e.message : e));
                        resolve();
                    });
                    return;
                }

                if (typeof vkBridge !== 'undefined' && vkBridge && isInsideVk()) {
                    self.platform = 'vk';
                    self.vkBridge = vkBridge;

                    vkBridge.send('VKWebAppInit').then(function() {
                        adLog('VKWebAppInit OK');
                        return vkBridge.send('VKWebAppGetUserInfo');
                    }).then(function(user) {
                        if (user) self.userId = user.id;
                    }).catch(function(e) {
                        adLog('Init warning: ' + (e && e.message ? e.message : e));
                    });

                    setTimeout(function() {
                        if (self.vkBridge && self.vkBridge.subscribe) {
                            try {
                                self.vkBridge.subscribe(function(event) {
                                    if (event.detail && event.detail.type === 'VKWebAppViewHide') {
                                        pauseGameForAd();
                                    }
                                });
                            } catch (e) {}
                        }
                        resolve();
                    }, 100);
                } else {
                    adLog('Not inside VK → web mode');
                    self.platform = 'web';
                    resolve();
                }
            });
        },

        signalReady: function() {
            if (this.platform === 'vk' && this.vkBridge) {
                try {
                    this.vkBridge.send('VKWebAppSetViewSettings', {
                        status_bar_style: 'dark',
                        action_bar_color: '#000000'
                    }).catch(function() {});
                } catch (e) {}
            }
        },

        preloadAds: function() {
            if (this.platform !== 'vk' || !this.vkBridge) return;
            this.vkBridge.send('VKWebAppCheckNativeAds', { ad_format: 'interstitial' }).catch(function() {});
            this.vkBridge.send('VKWebAppCheckNativeAds', { ad_format: 'reward' }).catch(function() {});
            adLog('Ads preloaded');
        },

        checkRewardAds: function() {
            if (this.platform !== 'vk' || !this.vkBridge) return Promise.resolve(false);
            return this.vkBridge.send('VKWebAppCheckNativeAds', { ad_format: 'reward' })
                .then(function(data) { return !!(data && data.result); })
                .catch(function() { return false; });
        },

        saveData: function(data) {
            try {
                localStorage.setItem('vk_snaiper_monety', String(data.monety));
                localStorage.setItem('vk_snaiper_skins', JSON.stringify(data.skins));
                localStorage.setItem('vk_snaiper_selectedSkin', data.selectedSkin);
                localStorage.setItem('vk_snaiper_volume', String(data.volume));
                localStorage.setItem('vk_snaiper_muted', data.muted ? '1' : '0');
                localStorage.setItem('vk_snaiper_bestLevel', String(data.bestLevel));
                localStorage.setItem('vk_snaiper_dailyDate', String(data.dailyDate || ''));
                localStorage.setItem('vk_snaiper_dailyStreak', String(data.dailyStreak || 0));
                localStorage.setItem('vk_snaiper_tutorialDone', data.tutorialDone ? '1' : '0');
                localStorage.setItem('vk_snaiper_chestFreeDate', String(data.chestFreeDate || ''));

                if (this.platform === 'vk' && this.vkBridge) {
                    this.vkBridge.send('VKWebAppStorageSet', {
                        key: 'vk_snaiper_save',
                        value: JSON.stringify(data)
                    }).catch(function() {});
                }
            } catch (e) {
                adLog('Save error: ' + e);
            }
        },

        loadData: function() {
            var self = this;
            return new Promise(function(resolve) {
                if (self.platform === 'vk' && self.vkBridge) {
                    self.vkBridge.send('VKWebAppStorageGet', {
                        keys: ['vk_snaiper_save']
                    }).then(function(result) {
                        if (result && result.keys && result.keys.length > 0 && result.keys[0].value) {
                            try {
                                var data = JSON.parse(result.keys[0].value);
                                if (data && typeof data === 'object') {
                                    resolve(data);
                                    return;
                                }
                            } catch (e) {}
                        }
                        resolve(fallbackLoad());
                    }).catch(function() {
                        resolve(fallbackLoad());
                    });
                } else {
                    resolve(fallbackLoad());
                }
            });

            function fallbackLoad() {
                var m = parseInt(localStorage.getItem('vk_snaiper_monety'));
                var s = JSON.parse(localStorage.getItem('vk_snaiper_skins') || 'null');
                var sel = localStorage.getItem('vk_snaiper_selectedSkin');
                var v = parseFloat(localStorage.getItem('vk_snaiper_volume'));
                var mut = localStorage.getItem('vk_snaiper_muted') === '1';
                var bl = parseInt(localStorage.getItem('vk_snaiper_bestLevel'));
                var dd = localStorage.getItem('vk_snaiper_dailyDate') || '';
                var ds = parseInt(localStorage.getItem('vk_snaiper_dailyStreak'));
                var td = localStorage.getItem('vk_snaiper_tutorialDone') === '1';
                var cf = localStorage.getItem('vk_snaiper_chestFreeDate') || '';

                return {
                    monety: isNaN(m) ? 0 : m,
                    skins: (s && s.length) ? s : ["knife"],
                    selectedSkin: sel || "knife",
                    volume: isNaN(v) ? 0.4 : v,
                    muted: mut,
                    bestLevel: isNaN(bl) || bl < 1 ? 1 : bl,
                    dailyDate: dd,
                    dailyStreak: isNaN(ds) ? 0 : ds,
                    tutorialDone: td,
                    chestFreeDate: cf
                };
            }
        },

        showInterstitial: function(onOpen, onClose, onError) {
            var self = this;
            var now = Date.now();
            var allowed = (now - this.sessionStartTime >= 120000) &&
                          (now - this.lastInterstitialTime >= 180000);

            if (!allowed) {
                if (onClose) onClose();
                return;
            }

            if (this.platform !== 'vk' || !this.vkBridge) {
                if (onClose) onClose();
                return;
            }

            if (onOpen) onOpen();

            this.vkBridge.send('VKWebAppShowNativeAds', { ad_format: 'interstitial' })
                .then(function() {
                    self.lastInterstitialTime = Date.now();
                    if (onClose) onClose();
                    self.preloadAds();
                })
                .catch(function() {
                    if (onError) onError();
                    if (onClose) onClose();
                    self.preloadAds();
                });
        },

        showRewarded: function(onOpen, onRewarded, onClose, onError) {
            var self = this;

            if (this.platform !== 'vk' || !this.vkBridge) {
                adLog('Rewarded: web-mode fallback');
                if (onOpen) onOpen();
                setTimeout(function() {
                    if (onRewarded) onRewarded();
                    if (onClose) onClose();
                }, 400);
                return;
            }

            this.vkBridge.send('VKWebAppCheckNativeAds', { ad_format: 'reward' })
                .then(function(checkData) {
                    if (checkData && checkData.result) {
                        self._doShowRewarded(onOpen, onRewarded, onClose, onError);
                    } else {
                        adLog('Rewarded: no materials → fallback grant');
                        if (onOpen) onOpen();
                        setTimeout(function() {
                            if (onRewarded) onRewarded();
                            if (onClose) onClose();
                        }, 300);
                    }
                })
                .catch(function() {
                    adLog('Rewarded: check unavailable → fallback grant');
                    if (onOpen) onOpen();
                    setTimeout(function() {
                        if (onRewarded) onRewarded();
                        if (onClose) onClose();
                    }, 300);
                });
        },

        _doShowRewarded: function(onOpen, onRewarded, onClose, onError) {
            var self = this;
            if (onOpen) onOpen();

            var settled = false;

            function finishOk() {
                if (settled) return;
                settled = true;
                adLog('Rewarded watched');
                if (onRewarded) onRewarded();
                if (onClose) onClose();
                self.preloadAds();
            }

            function finishFail() {
                if (settled) return;
                settled = true;
                adLog('Rewarded failed');
                if (onError) onError();
                if (onClose) onClose();
            }

            var hangTimer = setTimeout(finishFail, 45000);

            this.vkBridge.send('VKWebAppShowNativeAds', { ad_format: 'reward' })
                .then(function(data) {
                    clearTimeout(hangTimer);
                    if (data && data.result) finishOk();
                    else finishFail();
                })
                .catch(function() {
                    clearTimeout(hangTimer);
                    finishFail();
                });
        },

        getLanguage: function() {
            try {
                var urlParams = new URLSearchParams(window.location.search);
                var vkLang = urlParams.get('vk_language') || urlParams.get('language');
                if (vkLang === 'ru') return 'ru';
                if (vkLang === 'en') return 'en';
                var browserLang = (navigator.language || navigator.userLanguage || 'ru').toLowerCase();
                return browserLang.indexOf('ru') === 0 ? 'ru' : 'en';
            } catch (e) {
                return 'ru';
            }
        }
    };

    var loadedAssets = 0;
    var totalAssets = 0;
    var gameLoopStarted = false;
    var preloaderBar = document.getElementById('preloaderBar');
    var preloaderPercent = document.getElementById('preloaderPercent');
    var preloaderEl = document.getElementById('preloader');

    function updatePreloader() {
        var percent = 0;
        if (totalAssets > 0) {
            percent = Math.min(100, Math.floor((loadedAssets / totalAssets) * 100));
        }
        if (preloaderBar) preloaderBar.style.width = percent + '%';
        if (preloaderPercent) preloaderPercent.textContent = percent + '%';
    }

    function hidePreloader() {
        if (preloaderEl) preloaderEl.classList.add('hidden');
    }

    function finishLoading() {
        if (gameLoopStarted) return;
        gameLoopStarted = true;
        hidePreloader();
        nastroikaEkrana();
        lastTime = performance.now();
        igrovoiCikl(lastTime);
    }

    function assetLoaded() {
        loadedAssets++;
        updatePreloader();
        if (loadedAssets >= totalAssets) {
            finishLoading();
        }
    }

    var holst = document.getElementById("igrovoePole");
    var kist = holst ? holst.getContext("2d") : null;

    var uiMonety = document.getElementById("schetMonet");
    var uiPanelMonet = document.getElementById("panelMonet");
    var uiGlavnoeMenu = document.getElementById("glavnoeMenu");
    var uiEkranProigrysha = document.getElementById("ekranProigrysha");
    var uiEkranMagazina = document.getElementById("ekranMagazina");
    var uiSetkaSkinov = document.getElementById("setkaSkinov");
    var uiTekushiyUroven = document.getElementById("tekushiyUrovenUI");
    var uiPopupNagrada = document.getElementById("popupNagrada");

    var knopkaIgrat = document.getElementById("knopkaIgrat");
    var knopkaZanovo = document.getElementById("knopkaZanovo");
    var knopkaVoskresheniya = document.getElementById("knopkaVoskresheniya");
    var knopkaMagazin = document.getElementById("knopkaMagazin");
    var knopkaNazadIzMagazina = document.getElementById("knopkaNazadIzMagazina");
    var knopkaZvuka = document.getElementById("knopkaZvuka");
    var polzunokZvuka = document.getElementById("polzunokZvuka");
    var knopkaYazyka = document.getElementById("knopkaYazyka");
    var panelYazyka = document.getElementById("panelYazyka");

    var panelPauza = document.getElementById("panelPauza");
    var knopkaPauza = document.getElementById("knopkaPauza");
    var ekranPauzy = document.getElementById("ekranPauzy");
    var knopkaProdolzit = document.getElementById("knopkaProdolzit");
    var knopkaRestartPauza = document.getElementById("knopkaRestartPauza");
    var knopkaVMenyu = document.getElementById("knopkaVMenyu");
    var knopkaVMenyuGO = document.getElementById("knopkaVMenyuGO");

    var uiPanelLevel = document.getElementById("panelLevel");
    var uiPanelNozhei = document.getElementById("panelNozhei");
    var uiTekstLevel = document.getElementById("tekstLevel");
    var uiTekstNozhei = document.getElementById("tekstNozhei");

    var uiPopupDaily = document.getElementById("popupDaily");
    var uiTekstDaily = document.getElementById("tekstDaily");
    var knopkaDailyClaim = document.getElementById("knopkaDailyClaim");
    var knopkaDailyDouble = document.getElementById("knopkaDailyDouble");

    var uiPopupLevelComplete = document.getElementById("popupLevelComplete");
    var uiTekstLcReward = document.getElementById("tekstLcReward");
    var knopkaLcClaim = document.getElementById("knopkaLcClaim");
    var knopkaLcDouble = document.getElementById("knopkaLcDouble");

    var uiTuutorialHint = document.getElementById("tuutorialHint");
    var uiTekstRekord = document.getElementById("tekstRekord");

    var knopkaRunX2 = document.getElementById("knopkaRunX2");
    var uiRunStats = document.getElementById("uiRunStats");
    var knopkaChestFree = document.getElementById("knopkaChestFree");

    var tekstStreak = document.getElementById("tekstStreak");
    var tekstNextSkin = document.getElementById("tekstNextSkin");
    var tekstDailyStreak = document.getElementById("tekstDailyStreak");

    document.addEventListener('contextmenu', function(e) { e.preventDefault(); });
    document.addEventListener('selectstart', function(e) { e.preventDefault(); });
    document.addEventListener('dragstart', function(e) { e.preventDefault(); });

    var GAME_BASE_WIDTH = 400;
    var globalScale = 1;
    var lastTime = 0;
    var deltaTime = 0;
    var SPEED_MULTIPLIER = 0.80;

    var ugolArbuza = 0;
    var skorostArbuza = 0.03 * SPEED_MULTIPLIER;
    var startNozhY = 0;

    var nozh = { x: 200, y: 0, shirina: 40, vysota: 120, letit: false };
    var arbuz = { x: 200, y: 0, razmer: 100, bazi_Y: 0 };

    var fazaDvizheniya = 0;
    var meteor = { aktiven: false, ugol: 0, skorost: 0.04 * SPEED_MULTIPLIER, radiusOtArbuza: 160, razmer: 30 };

    var vteknutieNozhi = [];
    var yablokiNaArbuze = [];
    var bronyaNaArbuze = [];
    var oskolki = [];
    var tryaskaEkrana = 0;
    var uroven = 1;
    var nozhiDlyaPobedy = 5;
    var ostalosNozhei = 5;
    var bronyaProbytaNaUrovne = false;
    var vsplyvayushieTeksty = [];
    var krasnayaVspyshka = 0;
    var padayushiyNozh = null;
    var sostoyanieIgry = "MENU";
    var pauzaAktivna = false;

    var monety = 0;
    var kuplyennyeSkins = ["knife"];
    var vybrannyiSkinId = "knife";

    var bestLevel = 1;
    var dailyDate = '';
    var dailyStreak = 0;
    var tutorialDone = false;
    var currentLevelBonus = 0;
    var tutorialStep = -1;

    var runYabloki = 0;
    var runMonetyLocal = 0;
    var runX2Given = false;
    var vozrozhdeniyaNaUrovne = 0;
    var chestFreeDate = '';

    function pauseGameForAd() {
        if (masterGain) masterGain.gain.value = 0;
        if (sostoyanieIgry === "PLAY") sostoyanieIgry = "PAUSED";
    }

    function resumeGameAfterAd() {
        if (masterGain) masterGain.gain.value = isMuted ? 0 : currentVolume;
        if (sostoyanieIgry === "PAUSED" && !pauzaAktivna) sostoyanieIgry = "PLAY";
    }

    function otkrytPauzu() {
        if (sostoyanieIgry !== "PLAY" || pauzaAktivna) return;
        pauzaAktivna = true;
        sostoyanieIgry = "PAUSED";
        if (ekranPauzy) ekranPauzy.classList.remove("skryto");
    }

    function zakrytPauzu() {
        if (!pauzaAktivna) return;
        pauzaAktivna = false;
        if (ekranPauzy) ekranPauzy.classList.add("skryto");
        if (sostoyanieIgry === "PAUSED") sostoyanieIgry = "PLAY";
    }

    document.addEventListener('visibilitychange', function() {
        if (document.hidden) pauseGameForAd();
        else resumeGameAfterAd();
    });

    window.addEventListener('blur', pauseGameForAd);
    window.addEventListener('focus', resumeGameAfterAd);

    function scaleMenus() {
        var container = document.getElementById('gameContainer');
        var width = container ? container.clientWidth : window.innerWidth;
        var menuScale = width < 350 ? Math.max(0.6, width / 320) : 1.0;

        document.querySelectorAll('.popup-scale-target').forEach(function(menu) {
            if (menu.classList.contains('skryto')) return;
            if (menu.classList.contains('popup-overlay')) {
                menu.style.transform = 'translate(-50%, -50%) scale(' + menuScale + ')';
            } else {
                menu.style.transform = 'scale(' + menuScale + ')';
            }
        });
    }

    function updateHUD() {
        if (sostoyanieIgry === "PLAY" || sostoyanieIgry === "GAMEOVER") {
            if (uiPanelLevel) uiPanelLevel.classList.remove("skryto");
            if (uiPanelNozhei) uiPanelNozhei.classList.remove("skryto");

            var eb = (uroven % 5 === 0);
            if (uiTekstLevel) {
                uiTekstLevel.textContent = (eb ? t("boss") : t("level") + " ") + uroven;
                uiTekstLevel.style.color = eb ? "#FF4444" : "#FFFFFF";
            }
            if (uiTekstNozhei) uiTekstNozhei.textContent = t("knives") + " " + ostalosNozhei;
        } else {
            if (uiPanelLevel) uiPanelLevel.classList.add("skryto");
            if (uiPanelNozhei) uiPanelNozhei.classList.add("skryto");
        }

        if (panelPauza) {
            if (sostoyanieIgry === "PLAY") panelPauza.classList.remove("skryto");
            else panelPauza.classList.add("skryto");
        }

        if (sostoyanieIgry === "GAMEOVER") {
            if (knopkaVoskresheniya) {
                knopkaVoskresheniya.style.display = vozrozhdeniyaNaUrovne >= 2 ? "none" : "";
            }
            if (knopkaRunX2) {
                knopkaRunX2.style.display = (!runX2Given && runMonetyLocal > 0) ? "" : "none";
            }
            if (uiRunStats) {
                uiRunStats.textContent = t("stats") + ": " + runYabloki + " 🍎 (" + runMonetyLocal + ")";
            }
        }
    }

    function nastroikaEkrana() {
        if (!holst || !kist) return;

        var winWidth, winHeight;
        if (window.visualViewport) {
            winWidth = window.visualViewport.width;
            winHeight = window.visualViewport.height;
        } else {
            winWidth = window.innerWidth;
            winHeight = window.innerHeight;
        }

        winWidth = Math.max(0, winWidth - 20);
        winHeight = Math.max(0, winHeight - 20);

        var aspectRatio = 9 / 16;
        var finalWidth, finalHeight;

        if (winWidth / winHeight > aspectRatio) {
            finalHeight = winHeight;
            finalWidth = finalHeight * aspectRatio;
        } else {
            finalWidth = winWidth;
            finalHeight = finalWidth / aspectRatio;
        }

        var container = document.getElementById('gameContainer');
        if (container) {
            container.style.width = finalWidth + 'px';
            container.style.height = finalHeight + 'px';
        }

        var dpr = window.devicePixelRatio || 1;
        holst.width = Math.floor(finalWidth * dpr);
        holst.height = Math.floor(finalHeight * dpr);

        kist.setTransform(1, 0, 0, 1, 0, 0);
        kist.scale(dpr, dpr);

        globalScale = finalWidth / GAME_BASE_WIDTH;

        var uiScale = Math.max(0.5, Math.min(globalScale, 1.2));

        [uiPanelLevel, uiPanelNozhei].forEach(function(el) {
            if (el) {
                var ns = Math.max(10, 24 * uiScale);
                el.style.fontSize = ns + 'px';
                var sh = Math.max(1, 2 * uiScale);
                el.style.textShadow = sh + 'px ' + sh + 'px ' + (sh * 2) + 'px #000000';
            }
        });

        if (uiPanelMonet) {
            uiPanelMonet.style.fontSize = Math.max(12, 18 * uiScale) + 'px';
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

        var slider = document.getElementById('panelZvuka');
        if (slider) {
            var sc = Math.min(globalScale, 0.8);
            slider.style.transform = 'translate(' + (15 * sc) + 'px, ' + (50 * sc) + 'px) scale(' + sc + ')';
        }

        if (uiPanelMonet) {
            var sc2 = Math.min(globalScale, 0.8);
            uiPanelMonet.style.transform = 'translate(' + (-15 * sc2) + 'px, ' + (50 * sc2) + 'px) scale(' + sc2 + ')';
        }

        if (panelYazyka) {
            var sc3 = Math.max(0.6, Math.min(globalScale, 1));
            panelYazyka.style.transform = 'scale(' + sc3 + ')';
        }

        updateHUD();
        updateUI();
        scaleMenus();
    }

    function forceResize() {
        requestAnimationFrame(function() {
            nastroikaEkrana();
        });
    }

    function saveData() {
        PlatformAdapter.saveData({
            monety: monety,
            skins: kuplyennyeSkins,
            selectedSkin: vybrannyiSkinId,
            volume: currentVolume,
            muted: isMuted,
            bestLevel: bestLevel,
            dailyDate: dailyDate,
            dailyStreak: dailyStreak,
            tutorialDone: tutorialDone,
            chestFreeDate: chestFreeDate
        });
    }

    function loadDataFromAdapter() {
        PlatformAdapter.loadData().then(function(data) {
            if (data) {
                if (data.monety !== undefined) monety = data.monety;
                if (data.skins) kuplyennyeSkins = data.skins;
                if (data.selectedSkin) vybrannyiSkinId = data.selectedSkin;
                if (data.volume !== undefined) currentVolume = data.volume;
                if (data.muted !== undefined) isMuted = data.muted;
                if (data.bestLevel !== undefined) bestLevel = data.bestLevel;
                if (data.dailyDate !== undefined) dailyDate = data.dailyDate;
                if (data.dailyStreak !== undefined) dailyStreak = data.dailyStreak | 0;
                if (data.tutorialDone !== undefined) tutorialDone = !!data.tutorialDone;
                if (data.chestFreeDate !== undefined) chestFreeDate = data.chestFreeDate || '';

                updateUI();
                updateRecordUI();
                checkDailyReward();
                checkChestFreeBtn();
            }
        });
    }

    function updateUI() {
        if (uiMonety) uiMonety.innerText = monety;
        updateVolumeUI();
    }

    function getTodayKey() {
        try {
            return new Date().toISOString().slice(0, 10);
        } catch (e) {
            return '';
        }
    }

    function getYesterdayKey() {
        try {
            var d = new Date();
            d.setDate(d.getDate() - 1);
            return d.toISOString().slice(0, 10);
        } catch (e) {
            return '';
        }
    }

    function dailyBase(streak) {
        return 20 + Math.min(streak, 7) * 5;
    }

    function updateRecordUI() {
        if (uiTekstRekord) uiTekstRekord.innerText = t("record") + bestLevel;

        if (tekstStreak) {
            var today = getTodayKey();
            var ready = today && dailyDate !== today;
            tekstStreak.innerText = ready ? t("dailyReady") : (t("streakLabel") + " " + dailyStreak);
        }

        if (tekstNextSkin) {
            tekstNextSkin.innerText = nastupniySkin();
        }
    }

    function nastupniySkin() {
        var best = -1;
        for (var i = 0; i < vseSkins.length; i++) {
            var s = vseSkins[i];
            if (s.isGacha) continue;
            if (kuplyennyeSkins.indexOf(s.id) !== -1) continue;
            if (s.price <= 0) continue;
            if (best < 0 || s.price < best) best = s.price;
        }

        if (best < 0) return '';
        var need = Math.max(0, best - monety);
        return t("nextSkin") + " " + need + " 🍎";
    }

    function checkDailyReward() {
        var today = getTodayKey();
        if (!today) return;

        if (dailyDate !== today) {
            var y = getYesterdayKey();
            var prospective = (dailyDate === y) ? (dailyStreak + 1) : 1;

            if (uiTekstDaily) uiTekstDaily.innerText = '+' + dailyBase(prospective) + ' 🍎';
            if (tekstDailyStreak) tekstDailyStreak.innerText = t("streakLabel") + " " + prospective;
            if (uiPopupDaily) uiPopupDaily.classList.remove("skryto");

            scaleMenus();
        } else if (uiPopupDaily) {
            uiPopupDaily.classList.add("skryto");
        }
    }

    function zabratDaily(mult) {
        var today = getTodayKey();
        if (!today) return;

        if (dailyDate === today) {
            if (uiPopupDaily) uiPopupDaily.classList.add("skryto");
            return;
        }

        var y = getYesterdayKey();
        dailyStreak = (dailyDate === y) ? (dailyStreak + 1) : 1;

        var sum = dailyBase(dailyStreak) * mult;
        dailyDate = today;

        dobavitMonety(sum);
        saveData();

        if (uiPopupDaily) uiPopupDaily.classList.add("skryto");

        playSnd("win");
        updateRecordUI();
    }

    function checkChestFreeBtn() {
        if (!knopkaChestFree) return;
        var today = getTodayKey();
        knopkaChestFree.style.display = (today && chestFreeDate === today) ? "none" : "";
    }

    var audioContext = null;
    var masterGain = null;
    var isAudioUnlocked = false;
    var audioBuffers = {};
    var audioFileList = {
        throw: "throw.mp3",
        fail: "fail.mp3",
        apple: "apple.mp3",
        win: "win.mp3",
        chest: "chest.mp3"
    };

    function initAudio() {
        if (audioContext) return true;
        try {
            var AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (!AudioCtx) return false;
            audioContext = new AudioCtx();
            masterGain = audioContext.createGain();
            masterGain.gain.value = isMuted ? 0 : currentVolume;
            masterGain.connect(audioContext.destination);
            return true;
        } catch (e) {
            return false;
        }
    }

    function unlockAudio() {
        if (isAudioUnlocked) return;
        if (initAudio() && audioContext.state === 'suspended') {
            audioContext.resume().then(function() {
                isAudioUnlocked = true;
            }).catch(function() {});
        }
        isAudioUnlocked = true;
    }

    document.addEventListener('click', unlockAudio, { once: true, passive: true });
    document.addEventListener('touchstart', unlockAudio, { once: true, passive: true });
    document.addEventListener('keydown', unlockAudio, { once: true, passive: true });

    function loadAudioFiles() {
        var audioCount = Object.keys(audioFileList).length;
        if (!initAudio()) {
            for (var i = 0; i < audioCount; i++) assetLoaded();
            return;
        }

        Object.keys(audioFileList).forEach(function(key) {
            var url = audioFileList[key];
            fetch(url)
                .then(function(res) {
                    return res.ok ? res.arrayBuffer() : Promise.reject(new Error('404'));
                })
                .then(function(buf) {
                    return audioContext.decodeAudioData(buf);
                })
                .then(function(dec) {
                    audioBuffers[key] = dec;
                    assetLoaded();
                })
                .catch(function() {
                    assetLoaded();
                });
        });
    }

    function playSnd(sndName) {
        if (isMuted || currentVolume === 0 || !audioContext || !audioBuffers[sndName]) return;
        try {
            var src = audioContext.createBufferSource();
            src.buffer = audioBuffers[sndName];
            var gn = audioContext.createGain();
            gn.gain.value = currentVolume;
            src.connect(gn);
            gn.connect(masterGain);
            src.start(0);
        } catch (e) {}
    }

    function updateVolumeUI() {
        var v = isMuted ? 0 : currentVolume;
        if (masterGain) masterGain.gain.value = v;
        if (knopkaZvuka) knopkaZvuka.innerText = v === 0 ? "🔇" : "🔊";
        if (polzunokZvuka) polzunokZvuka.value = v;
    }

    var currentVolume = 0.4;
    var isMuted = false;

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

    var currentLang = 'ru';

    var i18n = {
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
            forVideo: "ЗА ВИДЕО",
            restart: "НАЧАТЬ ЗАНОВО",
            boss: "БОСС!",
            knives: "Ножей:",
            equipped: "В РУКАХ",
            equip: "ВЗЯТЬ",
            legendaryReward: "КЛИНОК КОСМОСА!",
            pause: "ПАУЗА",
            toMenu: "В ГЛАВНОЕ МЕНЮ",
            knife: "Нож",
            pencil: "Карандаш",
            sword: "Меч",
            shuriken: "Сюрикен",
            axe: "Топор",
            wand: "Посох",
            legendary: "Легендарный Клинок",
            record: "Рекорд: уровень ",
            dailyTitle: "ЕЖЕДНЕВНАЯ НАГРАДА",
            dailyClaim: "ЗАБРАТЬ",
            dailyDouble: "×2 ЗА ВИДЕО",
            lcTitle: "УРОВЕНЬ ПРОЙДЕН!",
            lcClaim: "ЗАБРАТЬ",
            lcDouble: "×2 ЗА ВИДЕО",
            runX2: "×2 ЗА ВИДЕО",
            freeChest: "БЕСПЛАТНО ЗА ВИДЕО",
            stats: "Забег",
            streakLabel: "Серия:",
            dailyReady: "🎁 Награда готова!",
            nextSkin: "До нового скина:",
            share: "ПОХВАСТАТЬСЯ",
            sharetext: "Фруктовый Снайпер: я дошёл до уровня",
            tut0: "Тапни, чтобы бросить нож",
            tut1: "Яблоко = монета! Не попади в шип, нож или метеор"
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
            forVideo: "FOR VIDEO AD",
            restart: "RESTART",
            boss: "BOSS!",
            knives: "Knives:",
            equipped: "EQUIPPED",
            equip: "EQUIP",
            legendaryReward: "COSMIC BLADE!",
            pause: "PAUSE",
            toMenu: "MAIN MENU",
            knife: "Knife",
            pencil: "Pencil",
            sword: "Sword",
            shuriken: "Shuriken",
            axe: "Axe",
            wand: "Wand",
            legendary: "Legendary Blade",
            record: "Best: level ",
            dailyTitle: "DAILY REWARD",
            dailyClaim: "CLAIM",
            dailyDouble: "×2 FOR VIDEO",
            lcTitle: "LEVEL COMPLETE!",
            lcClaim: "CLAIM",
            lcDouble: "×2 FOR VIDEO",
            runX2: "×2 FOR VIDEO",
            freeChest: "FREE FOR VIDEO",
            stats: "Run",
            streakLabel: "Streak:",
            dailyReady: "🎁 Reward ready!",
            nextSkin: "Next skin in:",
            share: "SHARE",
            sharetext: "Fruit Sniper: I reached level",
            tut0: "Tap to throw the knife",
            tut1: "Apple = coin! Avoid spikes, knives and meteors"
        }
    };

    function t(key) {
        return (i18n[currentLang] && i18n[currentLang][key]) || i18n.en[key] || key;
    }

    function obnovitKnopkuYazyka() {
        if (knopkaYazyka) {
            knopkaYazyka.innerText = (currentLang === 'en') ? '🌐 RU' : '🌐 EN';
        }
    }

    function applyLanguage() {
        var el = function(id) { return document.getElementById(id); };

        if (el("knopkaIgrat")) el("knopkaIgrat").innerText = t("play");
        if (el("knopkaMagazin")) el("knopkaMagazin").innerText = t("shop");
        if (el("knopkaShar")) el("knopkaShar").innerText = t("share");
        if (el("knopkaSharMenu")) el("knopkaSharMenu").innerText = t("share");
        if (el("ui_armory")) el("ui_armory").innerText = t("armory");
        if (el("ui_chest")) el("ui_chest").innerText = t("chest");
        if (el("ui_chance")) el("ui_chance").innerText = t("chance");
        if (el("knopkaSunduk")) el("knopkaSunduk").innerText = t("open") + " (30 🍎)";
        if (el("knopkaChestFree")) {
            el("knopkaChestFree").innerHTML = '<span class="btn-icon">🎬</span><span class="btn-text">' + t("freeChest") + '</span>';
        }
        if (el("knopkaNazadIzMagazina")) el("knopkaNazadIzMagazina").innerText = t("back");
        if (el("ui_reward")) el("ui_reward").innerText = t("reward");
        if (el("ui_claim")) el("ui_claim").innerText = t("claim");
        if (el("ui_gameover")) el("ui_gameover").innerText = t("gameover");
        if (el("ui_lvl_text")) el("ui_lvl_text").innerText = t("level");

        if (el("knopkaVoskresheniya")) {
            el("knopkaVoskresheniya").innerHTML =
                '<span class="btn-icon">🎬</span><span class="btn-text">' +
                t("continue") + '<br><small>' + t("forVideo") + '</small></span>';
        }

        if (el("knopkaRunX2")) {
            el("knopkaRunX2").innerHTML =
                '<span class="btn-icon">🎬</span><span class="btn-text">' + t("runX2") + '</span>';
        }

        if (el("knopkaZanovo")) el("knopkaZanovo").innerText = t("restart");
        if (el("ui_pauseTitle")) el("ui_pauseTitle").innerText = t("pause");
        if (el("knopkaProdolzit")) el("knopkaProdolzit").innerText = t("continue");
        if (el("knopkaRestartPauza")) el("knopkaRestartPauza").innerText = t("restart");
        if (el("knopkaVMenyu")) el("knopkaVMenyu").innerText = t("toMenu");
        if (el("knopkaVMenyuGO")) el("knopkaVMenyuGO").innerText = t("toMenu");
        if (el("ui_daily_title")) el("ui_daily_title").innerText = t("dailyTitle");
        if (el("knopkaDailyClaim")) el("knopkaDailyClaim").innerText = t("dailyClaim");
        if (el("knopkaDailyDouble")) {
            el("knopkaDailyDouble").innerHTML =
                '<span class="btn-icon">🎬</span><span class="btn-text">' + t("dailyDouble") + '</span>';
        }
        if (el("ui_lc_title")) el("ui_lc_title").innerText = t("lcTitle");
        if (el("knopkaLcClaim")) el("knopkaLcClaim").innerText = t("lcClaim");
        if (el("knopkaLcDouble")) {
            el("knopkaLcDouble").innerHTML =
                '<span class="btn-icon">🎬</span><span class="btn-text">' + t("lcDouble") + '</span>';
        }

        obnovitKnopkuYazyka();
        updateHUD();
        updateRecordUI();

        if (!tutorialDone && sostoyanieIgry === "PLAY" && tutorialStep >= 0) {
            showTutorial(tutorialStep);
        }

        otrisovatMagazin();
    }

    if (knopkaYazyka) {
        knopkaYazyka.onclick = function() {
            currentLang = (currentLang === 'en') ? 'ru' : 'en';
            try {
                localStorage.setItem('vk_snaiper_lang', currentLang);
            } catch (e) {}
            applyLanguage();
        };
    }

    var lastSharTime = 0;

    function showToast(msg) {
        var ts = document.getElementById("toastShar");

        if (!ts) {
            ts = document.createElement("div");
            ts.id = "toastShar";
            ts.className = "toast";
            var host = document.getElementById("interfeis") || document.body;
            host.appendChild(ts);
        }

        ts.innerText = msg || (currentLang === 'ru' ? 'Готово' : 'Done');

        ts.style.position = 'absolute';
        ts.style.left = '50%';
        ts.style.bottom = '14%';
        ts.style.transform = 'translateX(-50%) translateY(20px)';
        ts.style.background = 'rgba(0,0,0,.88)';
        ts.style.color = '#FFD700';
        ts.style.padding = '10px 18px';
        ts.style.borderRadius = '20px';
        ts.style.fontFamily = 'Arial, sans-serif';
        ts.style.fontWeight = 'bold';
        ts.style.fontSize = '14px';
        ts.style.textAlign = 'center';
        ts.style.whiteSpace = 'nowrap';
        ts.style.maxWidth = '86%';
        ts.style.overflow = 'hidden';
        ts.style.textOverflow = 'ellipsis';
        ts.style.border = '2px solid rgba(255,255,255,.25)';
        ts.style.boxShadow = '0 8px 24px rgba(0,0,0,.45)';
        ts.style.pointerEvents = 'none';
        ts.style.zIndex = '3000';
        ts.style.opacity = '0';
        ts.style.transition = 'opacity .25s ease, transform .25s ease';

        void ts.offsetWidth;

        ts.style.opacity = '1';
        ts.style.transform = 'translateX(-50%) translateY(0)';

        clearTimeout(ts._shTimer);
        ts._shTimer = setTimeout(function() {
            ts.style.opacity = '0';
            ts.style.transform = 'translateX(-50%) translateY(20px)';
        }, 1800);
    }

    function podelisRekordom() {
        var now = Date.now();
        if (now - lastSharTime < 1200) return;
        lastSharTime = now;

        adLog('share pressed, platform=' + PlatformAdapter.platform);

        var txt = t("sharetext") + " " + bestLevel + " 🍎";
        var link = (window.location.href || '').split('#')[0];
        var full = txt + ' ' + link;
        var done = false;

        function fin(msg) {
            if (done) return;
            done = true;
            showToast(msg);
        }

        function copyLegacy() {
            try {
                var ta = document.createElement("textarea");
                ta.value = full;
                ta.style.position = "fixed";
                ta.style.left = "-9999px";
                ta.style.opacity = "0";
                document.body.appendChild(ta);
                ta.select();

                var ok = false;
                try {
                    ok = document.execCommand("copy");
                } catch (e) {
                    ok = false;
                }

                document.body.removeChild(ta);

                fin(ok ? (currentLang === 'ru' ? 'Скопировано' : 'Copied') : (currentLang === 'ru' ? 'Не удалось скопировать' : 'Copy failed'));
            } catch (e) {
                fin(currentLang === 'ru' ? 'Не удалось скопировать' : 'Copy failed');
            }
        }

        function copyModern() {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(full).then(function() {
                    fin(currentLang === 'ru' ? 'Скопировано' : 'Copied');
                }).catch(function() {
                    copyLegacy();
                });
            } else {
                copyLegacy();
            }
        }

        function nativeShare() {
            if (navigator.share) {
                try {
                    var p = navigator.share({
                        title: t("title"),
                        text: txt,
                        url: link
                    });

                    if (p && typeof p.then === "function") {
                        p.then(function() {
                            fin(currentLang === 'ru' ? 'Готово' : 'Done');
                        }).catch(function(err) {
                            if (err && err.name === "AbortError") {
                                done = true;
                                return;
                            }
                            copyModern();
                        });
                    } else {
                        fin(currentLang === 'ru' ? 'Готово' : 'Done');
                    }
                    return;
                } catch (e) {}
            }
            copyModern();
        }

        function vkShare() {
            try {
                var res = PlatformAdapter.vkBridge.send("VKWebAppShare", { link: link });

                if (res && typeof res.then === "function") {
                    res.then(function() {
                        fin(currentLang === 'ru' ? 'Отправлено в VK' : 'Shared to VK');
                    }).catch(function() {
                        nativeShare();
                    });
                } else {
                    fin(currentLang === 'ru' ? 'Отправлено в VK' : 'Shared to VK');
                }
            } catch (e) {
                nativeShare();
            }
        }

        if (PlatformAdapter.platform === 'vk' && PlatformAdapter.vkBridge && typeof PlatformAdapter.vkBridge.send === 'function') {
            vkShare();
            return;
        }

        nativeShare();
    }

    function sozdatSharKnopki() {
        var menu = document.getElementById("glavnoeMenu");
        if (menu && !document.getElementById("knopkaSharMenu")) {
            var b1 = document.createElement("button");
            b1.id = "knopkaSharMenu";
            b1.className = "knopka knopkaSharCvet";
            b1.type = "button";
            b1.innerText = t("share");
            b1.style.background = "#00ACC1";
            b1.style.boxShadow = "0 4px 0 #00838F";
            b1.style.width = "100%";
            b1.style.marginTop = "4px";

            var anchor1 = document.getElementById("knopkaMagazin");
            if (anchor1 && anchor1.parentNode === menu) {
                menu.insertBefore(b1, anchor1.nextSibling);
            } else {
                menu.appendChild(b1);
            }
        }

        var go = document.getElementById("ekranProigrysha");
        if (go && !document.getElementById("knopkaShar")) {
            var b2 = document.createElement("button");
            b2.id = "knopkaShar";
            b2.className = "knopka knopkaSharCvet";
            b2.type = "button";
            b2.innerText = t("share");
            b2.style.background = "#00ACC1";
            b2.style.boxShadow = "0 4px 0 #00838F";
            b2.style.width = "100%";
            b2.style.marginTop = "4px";

            var anchor2 = document.getElementById("knopkaRunX2") ||
                          document.getElementById("knopkaVoskresheniya") ||
                          document.getElementById("knopkaZanovo");

            if (anchor2 && anchor2.parentNode === go) {
                go.insertBefore(b2, anchor2);
            } else {
                go.appendChild(b2);
            }
        }
    }

    document.addEventListener('click', function(e) {
        var target = e.target;
        if (!target || !target.closest) return;

        var btn = target.closest('#knopkaShar, #knopkaSharMenu, [data-share]');
        if (btn) {
            e.preventDefault();
            podelisRekordom();
        }
    }, true);

    var vseSkins = [
        { id: "knife", price: 0, file: "knife.png", speed: 35 * SPEED_MULTIPLIER, appleHitbox: 0.55, coinMult: 1, slow: 1, pierce: false, isGacha: false },
        { id: "pencil", price: 10, file: "pencil.png", speed: 55 * SPEED_MULTIPLIER, appleHitbox: 0.55, coinMult: 1, slow: 1, pierce: false, isGacha: false },
        { id: "sword", price: 25, file: "sword.png", speed: 35 * SPEED_MULTIPLIER, appleHitbox: 0.9, coinMult: 1, slow: 1, pierce: false, isGacha: false },
        { id: "shuriken", price: 45, file: "shuriken.png", speed: 35 * SPEED_MULTIPLIER, appleHitbox: 0.55, coinMult: 2, slow: 1, pierce: false, isGacha: false },
        { id: "axe", price: 70, file: "axe.png", speed: 35 * SPEED_MULTIPLIER, appleHitbox: 0.55, coinMult: 1, slow: 1, pierce: true, isGacha: false },
        { id: "wand", price: 100, file: "wand.png", speed: 35 * SPEED_MULTIPLIER, appleHitbox: 0.55, coinMult: 1, slow: 0.8, pierce: false, isGacha: false },
        { id: "legendary", price: 999, file: "legendary.png", speed: 60 * SPEED_MULTIPLIER, appleHitbox: 1.0, coinMult: 3, slow: 0.5, pierce: true, isGacha: true }
    ];

    function poluchitStatiSkina() {
        return vseSkins.find(function(s) { return s.id === vybrannyiSkinId; }) || vseSkins[0];
    }

    totalAssets = 10 + vseSkins.length + Object.keys(audioFileList).length;
    updatePreloader();

    var kartinkaYabloko = new Image(); kartinkaYabloko.src = "apple.png";
    var kartinkaBronya = new Image(); kartinkaBronya.src = "spike.png";
    var kartinkaMeteor = new Image(); kartinkaMeteor.src = "meteor.png";
    var kartinkaSunduk = new Image(); kartinkaSunduk.src = "chest.png";
    var kartinkaArbuz = new Image(); kartinkaArbuz.src = "target.png";
    var kartinkaBoss = new Image(); kartinkaBoss.src = "boss.png";
    var kartinkaPizza = new Image(); kartinkaPizza.src = "pizza.png";
    var kartinkaBurger = new Image(); kartinkaBurger.src = "burger.png";
    var kartinkaStump = new Image(); kartinkaStump.src = "stump.png";
    var kartinkaGolem = new Image(); kartinkaGolem.src = "golem.png";

    var kartinkiOruzhiya = {};

    [kartinkaYabloko, kartinkaBronya, kartinkaMeteor, kartinkaSunduk, kartinkaArbuz,
     kartinkaBoss, kartinkaPizza, kartinkaBurger, kartinkaStump, kartinkaGolem].forEach(function(img) {
        img.onload = assetLoaded;
        img.onerror = assetLoaded;
    });

    vseSkins.forEach(function(s) {
        var i = new Image();
        i.src = s.file;
        i.onload = assetLoaded;
        i.onerror = assetLoaded;
        kartinkiOruzhiya[s.id] = i;
    });

    if (knopkaIgrat) {
        knopkaIgrat.onclick = function() {
            unlockAudio();
            sbrosIgry();
        };
    }

    if (knopkaMagazin) {
        knopkaMagazin.onclick = function() {
            if (uiGlavnoeMenu) uiGlavnoeMenu.classList.add("skryto");
            if (uiEkranMagazina) uiEkranMagazina.classList.remove("skryto");
            otrisovatMagazin();
        };
    }

    if (knopkaNazadIzMagazina) {
        knopkaNazadIzMagazina.onclick = function() {
            if (uiEkranMagazina) uiEkranMagazina.classList.add("skryto");
            if (uiGlavnoeMenu) uiGlavnoeMenu.classList.remove("skryto");
        };
    }

    if (knopkaPauza) knopkaPauza.onclick = otkrytPauzu;
    if (knopkaProdolzit) knopkaProdolzit.onclick = zakrytPauzu;
    if (knopkaRestartPauza) knopkaRestartPauza.onclick = function() { zakrytPauzu(); sbrosIgry(); };
    if (knopkaVMenyu) knopkaVMenyu.onclick = function() { zakrytPauzu(); vozvratVMenyu(); };
    if (knopkaZanovo) knopkaZanovo.onclick = function() { sbrosIgry(); };

    if (knopkaVMenyuGO) {
        knopkaVMenyuGO.onclick = function() {
            vozvratVMenyu();
            PlatformAdapter.showInterstitial(pauseGameForAd, resumeGameAfterAd, resumeGameAfterAd);
        };
    }

    if (knopkaDailyClaim) {
        knopkaDailyClaim.onclick = function() {
            zabratDaily(1);
        };
    }

    if (knopkaDailyDouble) {
        knopkaDailyDouble.onclick = function() {
            var today = getTodayKey();
            if (dailyDate === today) {
                if (uiPopupDaily) uiPopupDaily.classList.add("skryto");
                return;
            }

            PlatformAdapter.showRewarded(
                pauseGameForAd,
                function() {
                    zabratDaily(2);
                },
                function() {},
                function() {
                    if (uiPopupDaily) uiPopupDaily.classList.add("skryto");
                }
            );
        };
    }

    function dobavitMonety(k) {
        monety += k;
        updateUI();
        saveData();

        if (sostoyanieIgry === "MENU") {
            otrisovatMagazin();
            var b = document.getElementById("knopkaSunduk");
            if (b) b.disabled = monety < 30;
            updateRecordUI();
        }
    }

    window._game = {};

    window._game.otkrytSunduk = function(free) {
        var b = document.getElementById("knopkaSunduk");

        if (!free) {
            if (monety < 30 || (b && b.disabled)) return;
            if (b) b.disabled = true;
            dobavitMonety(-30);
        }

        playSnd("chest");

        var c = document.getElementById("kartinkaSunduka");
        if (c) c.classList.add("chest-opening");

        setTimeout(function() {
            if (c) c.classList.remove("chest-opening");

            var sh = Math.random();
            var nag = "";

            if (sh <= 0.05 && !kuplyennyeSkins.includes("legendary")) {
                kuplyennyeSkins.push("legendary");
                saveData();
                nag = t("legendaryReward");
                var tx = document.getElementById("tekstNagrady");
                if (tx) tx.style.color = "#FFD700";
            } else {
                var r = Math.random();
                var k = 0;

                if (r < 0.35) k = 10;
                else if (r < 0.75) k = 20;
                else if (r < 0.90) k = 30;
                else if (r < 0.97) k = 40;
                else k = 50;

                dobavitMonety(k);
                nag = "+" + k + " 🍎";

                var tx2 = document.getElementById("tekstNagrady");
                if (tx2) tx2.style.color = "white";
            }

            playSnd("win");

            var tx3 = document.getElementById("tekstNagrady");
            if (tx3) tx3.innerText = nag;

            if (uiPopupNagrada) uiPopupNagrada.classList.remove("skryto");

            checkChestFreeBtn();
            updateRecordUI();
        }, 800);
    };

    window._game.chestFree = function() {
        var today = getTodayKey();
        if (!today || chestFreeDate === today) return;

        PlatformAdapter.showRewarded(
            pauseGameForAd,
            function() {
                chestFreeDate = today;
                saveData();
                window._game.otkrytSunduk(true);
                checkChestFreeBtn();
            },
            resumeGameAfterAd,
            function() {}
        );
    };

    window._game.zakrytPopup = function() {
        if (uiPopupNagrada) uiPopupNagrada.classList.add("skryto");
        otrisovatMagazin();
    };

    window._game.kupitSkin = function(id) {
        var s = vseSkins.find(function(x) { return x.id === id; });
        if (!s) return;

        if (monety >= s.price && !kuplyennyeSkins.includes(id)) {
            dobavitMonety(-s.price);
            kuplyennyeSkins.push(id);
            saveData();
            playSnd("apple");
            window._game.vybratSkin(id);
            updateRecordUI();
        }
    };

    window._game.vybratSkin = function(id) {
        if (kuplyennyeSkins.includes(id)) {
            vybrannyiSkinId = id;
            saveData();
            otrisovatMagazin();
        }
    };

    function otrisovatMagazin() {
        if (!uiSetkaSkinov) return;

        var h = "";

        vseSkins.forEach(function(s) {
            if (s.isGacha && !kuplyennyeSkins.includes(s.id)) return;

            var ok = kuplyennyeSkins.includes(s.id);
            var eq = (vybrannyiSkinId === s.id);
            var bh = "";

            if (eq) {
                bh = '<button class="MknopkaVybrano" disabled>' + t("equipped") + '</button>';
            } else if (ok) {
                bh = '<button class="MknopkaVybrat" onclick="window._game.vybratSkin(\'' + s.id + '\')">' + t("equip") + '</button>';
            } else {
                var can = monety >= s.price;
                bh = '<button class="' + (can ? "MknopkaKupit" : "MknopkaKupit serya") + '" onclick="window._game.kupitSkin(\'' + s.id + '\')" ' + (!can ? "disabled" : "") + '>' + s.price + ' 🍎</button>';
            }

            var skinName = t(s.id);
            var desc = "";

            if (s.id === "knife") desc = currentLang === 'ru' ? "Стандартный нож" : "Standard knife";
            else if (s.id === "pencil") desc = currentLang === 'ru' ? "Летит очень быстро" : "Flies very fast";
            else if (s.id === "sword") desc = currentLang === 'ru' ? "Увеличенный сбор яблок" : "Increased apple collection";
            else if (s.id === "shuriken") desc = currentLang === 'ru' ? "x" + s.coinMult + " монет за яблоко" : "x" + s.coinMult + " coins per apple";
            else if (s.id === "axe") desc = currentLang === 'ru' ? "Пробивает 1 шип" : "Pierces 1 spike";
            else if (s.id === "wand") desc = currentLang === 'ru' ? "Замедляет время" : "Slows down time";
            else if (s.id === "legendary") desc = currentLang === 'ru' ? "x" + s.coinMult + " монет, пробитие и замедление" : "x" + s.coinMult + " coins, pierce & slow";
            else desc = currentLang === 'ru' ? "Обычный" : "Common";

            h += '<div class="' + (s.isGacha ? "kartochkaSkina legendary" : "kartochkaSkina") + '">' +
                 '<img src="' + s.file + '" alt="' + skinName + '">' +
                 '<div class="nazvanieSkina">' + skinName + '</div>' +
                 '<div class="opisanieSkina">' + desc + '</div>' +
                 bh +
                 '</div>';
        });

        uiSetkaSkinov.innerHTML = h;

        var b = document.getElementById("knopkaSunduk");
        if (b) {
            b.disabled = monety < 30;
            b.innerText = t("open") + " (30 🍎)";
        }

        checkChestFreeBtn();
    }

    if (knopkaVoskresheniya) {
        knopkaVoskresheniya.onclick = function() {
            PlatformAdapter.showRewarded(
                pauseGameForAd,
                voskresitIgryoka,
                resumeGameAfterAd,
                resumeGameAfterAd
            );
        };
    }

    if (knopkaRunX2) {
        knopkaRunX2.onclick = function() {
            if (runX2Given || runMonetyLocal <= 0) return;

            PlatformAdapter.showRewarded(
                pauseGameForAd,
                function() {
                    runX2Given = true;
                    dobavitMonety(runMonetyLocal);
                    playSnd("win");
                    updateHUD();
                },
                resumeGameAfterAd,
                function() {
                    updateHUD();
                }
            );
        };
    }

    function voskresitIgryoka() {
        vozrozhdeniyaNaUrovne++;

        if (uiEkranProigrysha) uiEkranProigrysha.classList.add("skryto");

        nozh.y = startNozhY;
        nozh.letit = false;
        sostoyanieIgry = "PLAY";
        padayushiyNozh = null;
        krasnayaVspyshka = 0;

        updateHUD();
    }

    function vozvratVMenyu() {
        sostoyanieIgry = "MENU";
        pauzaAktivna = false;

        if (uiEkranProigrysha) uiEkranProigrysha.classList.add("skryto");
        if (ekranPauzy) ekranPauzy.classList.add("skryto");
        if (uiPopupNagrada) uiPopupNagrada.classList.add("skryto");
        if (uiPopupLevelComplete) uiPopupLevelComplete.classList.add("skryto");
        if (uiGlavnoeMenu) uiGlavnoeMenu.classList.remove("skryto");
        if (uiPanelMonet) uiPanelMonet.classList.remove("skryto");

        vteknutieNozhi = [];
        yablokiNaArbuze = [];
        bronyaNaArbuze = [];
        oskolki = [];

        nozh.letit = false;
        nozh.y = startNozhY;
        padayushiyNozh = null;

        hideTutorial();
        updateRecordUI();
        updateHUD();
    }

    function sdelatBrosok() {
        if (sostoyanieIgry === "PLAY" && !nozh.letit && ostalosNozhei > 0) {
            nozh.letit = true;
            playSnd("throw");
            if (!tutorialDone && tutorialStep === 0) showTutorial(1);
        }
    }

    function handleInput(e) {
        var tgt = e.target;

        if (
            tgt.id === "polzunokZvuka" ||
            tgt.id === "knopkaZvuka" ||
            tgt.id === "knopkaYazyka" ||
            tgt.id === "knopkaPauza" ||
            (tgt.closest && (
                tgt.closest('.knopka') ||
                tgt.closest('#panelZvuka') ||
                tgt.closest('#panelYazyka') ||
                tgt.closest('#panelPauza')
            ))
        ) {
            return;
        }

        if (e.type === 'touchstart' || e.type === 'mousedown') {
            e.preventDefault();
            sdelatBrosok();
        }
    }

    if (holst) {
        holst.addEventListener("mousedown", handleInput);
        holst.addEventListener("touchstart", handleInput, { passive: false });
    }

    window.addEventListener("keydown", function(e) {
        if (e.code === "Space" || e.code === "KeyW" || e.code === "ArrowUp") {
            if (e.code === "Space") e.preventDefault();
            sdelatBrosok();
        }

        if (e.code === "Escape") {
            if (pauzaAktivna) zakrytPauzu();
            else otkrytPauzu();
        }
    });

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
        pauzaAktivna = false;
        currentLevelBonus = 0;

        runYabloki = 0;
        runMonetyLocal = 0;
        runX2Given = false;
        vozrozhdeniyaNaUrovne = 0;

        if (ekranPauzy) ekranPauzy.classList.add("skryto");
        if (uiEkranProigrysha) uiEkranProigrysha.classList.add("skryto");
        if (uiPopupNagrada) uiPopupNagrada.classList.add("skryto");
        if (uiPopupLevelComplete) uiPopupLevelComplete.classList.add("skryto");

        if (arbuz) arbuz.y = arbuz.bazi_Y;

        meteor.aktiven = false;
        meteor.skorost = 0.04 * SPEED_MULTIPLIER;

        sostoyanieIgry = "PLAY";

        if (uiGlavnoeMenu) uiGlavnoeMenu.classList.add("skryto");

        sozdatYablokiIBronyu();

        if (!tutorialDone) showTutorial(0);
        else hideTutorial();

        updateHUD();
        updateUI();
    }

    function sozdatYablokiIBronyu() {
        yablokiNaArbuze = [];
        bronyaNaArbuze = [];
        bronyaProbytaNaUrovne = false;

        var ky = Math.floor(Math.random() * 3);

        for (var i = 0; i < ky; i++) {
            var p = 0;
            var u;
            do {
                u = Math.random() * Math.PI * 2;
                p++;
            } while (!bezopasnyUgol(u, yablokiNaArbuze, 0.65) && p < 50);
            yablokiNaArbuze.push(u);
        }

        if (uroven >= 3) {
            var kb = 1 + Math.floor(uroven / 5);
            if (kb > 3) kb = 3;

            for (var j = 0; j < kb; j++) {
                var p2 = 0;
                var u2;
                var z = yablokiNaArbuze.concat(bronyaNaArbuze);

                do {
                    u2 = Math.random() * Math.PI * 2;
                    p2++;
                } while (!bezopasnyUgol(u2, z, 0.65) && p2 < 50);

                bronyaNaArbuze.push(u2);
            }
        }
    }

    function bezopasnyUgol(nu, mz, md) {
        for (var i = 0; i < mz.length; i++) {
            var r = Math.abs(nu - mz[i]) % (Math.PI * 2);
            if (r > Math.PI) r = (Math.PI * 2) - r;
            if (r < md) return false;
        }
        return true;
    }

    function showTutorial(step) {
        if (tutorialDone) {
            hideTutorial();
            return;
        }

        tutorialStep = step;
        if (!uiTuutorialHint) return;

        uiTuutorialHint.innerText = t(step === 0 ? "tut0" : "tut1");
        uiTuutorialHint.classList.remove("skryto");
    }

    function hideTutorial() {
        tutorialStep = -1;
        if (uiTuutorialHint) uiTuutorialHint.classList.add("skryto");
    }

    function closeLevelPopupOnly() {
        if (uiPopupLevelComplete) uiPopupLevelComplete.classList.add("skryto");
        currentLevelBonus = 0;
        sostoyanieIgry = "PLAY";
        updateHUD();
        scaleMenus();
    }

    function pokazatPopupLevelComplete(bonus) {
        currentLevelBonus = bonus;

        if (uiTekstLcReward) uiTekstLcReward.innerText = '+' + bonus + ' 🍎';
        if (uiPopupLevelComplete) uiPopupLevelComplete.classList.remove("skryto");

        sostoyanieIgry = "POPUP";
        updateHUD();
        scaleMenus();
    }

    if (knopkaLcClaim) {
        knopkaLcClaim.onclick = function() {
            closeLevelPopupOnly();
            PlatformAdapter.showInterstitial(pauseGameForAd, resumeGameAfterAd, resumeGameAfterAd);
        };
    }

    if (knopkaLcDouble) {
        knopkaLcDouble.onclick = function() {
            PlatformAdapter.showRewarded(
                pauseGameForAd,
                function() {
                    if (currentLevelBonus > 0) {
                        dobavitMonety(currentLevelBonus);
                        playSnd("win");
                    }
                    closeLevelPopupOnly();
                },
                function() {
                    PlatformAdapter.showInterstitial(pauseGameForAd, resumeGameAfterAd, resumeGameAfterAd);
                },
                function() {
                    closeLevelPopupOnly();
                }
            );
        };
    }

    function podgotovitNovyyUroven() {
        var eb = (uroven % 5 === 0);
        var bn = 5 + Math.floor(uroven / 3);

        if (eb) bn += 1;
        if (bn > 7) bn = 7;

        nozhiDlyaPobedy = bn;
        ostalosNozhei = bn;
        vteknutieNozhi = [];

        sozdatYablokiIBronyu();

        var ns = 0.03 + (uroven * 0.002);
        if (ns > 0.07) ns = 0.07;

        skorostArbuza = ns * SPEED_MULTIPLIER * (Math.random() > 0.5 ? 1 : -1);

        if (uroven >= 8) {
            meteor.aktiven = true;
            meteor.skorost = (0.03 + Math.random() * 0.04) * SPEED_MULTIPLIER;
            if (Math.random() > 0.5) meteor.skorost *= -1;
        } else {
            meteor.aktiven = false;
        }
    }

    function sleduyushiyUroven() {
        playSnd("win");
        tryaskaEkrana = 15;

        var cv = ["#ff3333", "#cc0000", "#ff6666", "#2eb82e", "#000", "#d4a373"];

        for (var i = 0; i < 80; i++) {
            var es = Math.random() > 0.85;
            oskolki.push({
                x: 200,
                y: arbuz.y,
                vx: (Math.random() - 0.5) * 25,
                vy: (Math.random() - 0.5) * 25 - 5,
                razmer: es ? 3 : Math.random() * 8 + 3,
                cvet: es ? "#000" : cv[Math.floor(Math.random() * cv.length)],
                zhizn: 1,
                skorostIscheznoveniya: Math.random() * 0.02 + 0.01
            });
        }

        var passedLevel = uroven;
        var bonus = 3 + Math.floor(passedLevel / 2);

        dobavitMonety(bonus);

        if (passedLevel + 1 > bestLevel) {
            bestLevel = passedLevel + 1;
            saveData();
            updateRecordUI();
        }

        if (!tutorialDone) {
            tutorialDone = true;
            saveData();
            hideTutorial();
        }

        vozrozhdeniyaNaUrovne = 0;

        uroven++;
        podgotovitNovyyUroven();
        updateHUD();
        pokazatPopupLevelComplete(bonus);
    }

    function poluchitKartinkuMisheni() {
        var eb = (uroven % 5 === 0);
        var ep = Math.ceil(uroven / 5) % 3;

        if (ep === 1) return eb ? kartinkaBoss : kartinkaArbuz;
        if (ep === 2) return eb ? kartinkaBurger : kartinkaPizza;
        return eb ? kartinkaGolem : kartinkaStump;
    }

    function igrovoiCikl(currentTime) {
        if (!kist || !holst) return;

        deltaTime = (currentTime - lastTime) / 1000;
        lastTime = currentTime;

        if (deltaTime > 0.1) deltaTime = 0.1;

        requestAnimationFrame(igrovoiCikl);

        kist.clearRect(0, 0, holst.width, holst.height);
        kist.save();
        kist.scale(globalScale, globalScale);

        if (tryaskaEkrana > 0) {
            kist.translate((Math.random() - 0.5) * tryaskaEkrana, (Math.random() - 0.5) * tryaskaEkrana);
            tryaskaEkrana -= 0.5;
        }

        var eb = (uroven % 5 === 0);
        var ss = poluchitStatiSkina();
        var tr = arbuz.razmer;
        var mx = 0;
        var my = 0;

        if (meteor.aktiven && (sostoyanieIgry === "PLAY" || sostoyanieIgry === "GAMEOVER")) {
            meteor.ugol += meteor.skorost * deltaTime * 60;
            mx = arbuz.x + Math.cos(meteor.ugol) * meteor.radiusOtArbuza;
            my = arbuz.y + Math.sin(meteor.ugol) * meteor.radiusOtArbuza;
        }

        if (sostoyanieIgry === "PLAY") {
            if (uroven >= 6) {
                fazaDvizheniya += (0.04 + (uroven * 0.001)) * deltaTime * 60;
                arbuz.y = arbuz.bazi_Y + Math.sin(fazaDvizheniya) * 30;

                if (uroven >= 11) {
                    tr = arbuz.razmer + Math.sin(fazaDvizheniya * 2.5) * 15;
                }
            } else {
                arbuz.y = arbuz.bazi_Y;
            }

            if (nozh.letit) {
                nozh.y -= ss.speed * deltaTime * 60;

                if (meteor.aktiven) {
                    var dx = nozh.x - mx;
                    var dy = nozh.y - my;
                    var d = Math.sqrt(dx * dx + dy * dy);

                    if (d < meteor.razmer + nozh.shirina / 2) {
                        playSnd("fail");
                        nozh.letit = false;
                        sostoyanieIgry = "GAMEOVER";
                        tryaskaEkrana = 25;
                        krasnayaVspyshka = 0.8;

                        for (var s = 0; s < 30; s++) {
                            oskolki.push({
                                x: mx,
                                y: my,
                                vx: (Math.random() - 0.5) * 20,
                                vy: (Math.random() - 0.5) * 20,
                                razmer: Math.random() * 5 + 2,
                                cvet: "#FFA500",
                                zhizn: 1,
                                skorostIscheznoveniya: Math.random() * 0.02 + 0.01
                            });
                        }

                        padayushiyNozh = {
                            x: nozh.x,
                            y: nozh.y,
                            vx: (Math.random() > 0.5 ? 6 : -6),
                            vy: -10,
                            ugol: 0,
                            vrashenie: 0.4
                        };

                        nozh.y = 9999;

                        if (uiTekushiyUroven) uiTekushiyUroven.innerText = uroven;
                        if (uiEkranProigrysha) uiEkranProigrysha.classList.remove("skryto");

                        updateHUD();
                        PlatformAdapter.checkRewardAds();
                    }
                }

                if (nozh.letit && nozh.y <= arbuz.y + tr) {
                    nozh.letit = false;

                    var uz = -ugolArbuza;
                    var pn = false;
                    var pb = false;
                    var ib = -1;

                    for (var i = 0; i < vteknutieNozhi.length; i++) {
                        var r = Math.abs(uz - vteknutieNozhi[i]) % (Math.PI * 2);
                        if (r > Math.PI) r = (Math.PI * 2) - r;
                        if (r < 0.35) {
                            pn = true;
                            break;
                        }
                    }

                    for (var k = 0; k < bronyaNaArbuze.length; k++) {
                        var r2 = Math.abs(uz - bronyaNaArbuze[k]) % (Math.PI * 2);
                        if (r2 > Math.PI) r2 = (Math.PI * 2) - r2;
                        if (r2 < 0.45) {
                            pb = true;
                            ib = k;
                            break;
                        }
                    }

                    if (pb && ss.pierce && !bronyaProbytaNaUrovne) {
                        bronyaNaArbuze.splice(ib, 1);
                        bronyaProbytaNaUrovne = true;
                        pb = false;

                        for (var s2 = 0; s2 < 20; s2++) {
                            oskolki.push({
                                x: nozh.x,
                                y: nozh.y - 20,
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
                    } else if (pn || pb) {
                        playSnd("fail");
                        sostoyanieIgry = "GAMEOVER";
                        tryaskaEkrana = 20;
                        krasnayaVspyshka = 0.6;

                        for (var s3 = 0; s3 < 25; s3++) {
                            oskolki.push({
                                x: 200,
                                y: arbuz.y + tr,
                                vx: (Math.random() - 0.5) * 20,
                                vy: (Math.random() - 0.5) * 20,
                                razmer: Math.random() * 4 + 2,
                                cvet: "#FFF",
                                zhizn: 1,
                                skorostIscheznoveniya: Math.random() * 0.02 + 0.01
                            });
                        }

                        padayushiyNozh = {
                            x: nozh.x,
                            y: arbuz.y + tr,
                            vx: (Math.random() > 0.5 ? 5 : -5),
                            vy: -15,
                            ugol: 0,
                            vrashenie: 0.3
                        };

                        nozh.y = 9999;

                        if (uiTekushiyUroven) uiTekushiyUroven.innerText = uroven;
                        if (uiEkranProigrysha) uiEkranProigrysha.classList.remove("skryto");

                        updateHUD();
                        PlatformAdapter.checkRewardAds();
                    } else {
                        for (var j = 0; j < yablokiNaArbuze.length; j++) {
                            var r3 = Math.abs(uz - yablokiNaArbuze[j]) % (Math.PI * 2);
                            if (r3 > Math.PI) r3 = (Math.PI * 2) - r3;

                            if (r3 < ss.appleHitbox) {
                                playSnd("apple");
                                yablokiNaArbuze.splice(j, 1);

                                var ng = 1 * ss.coinMult;
                                runYabloki++;
                                runMonetyLocal += ng;

                                dobavitMonety(ng);

                                for (var s4 = 0; s4 < 15; s4++) {
                                    oskolki.push({
                                        x: 200,
                                        y: arbuz.y + tr,
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

                        if (ostalosNozhei <= 0) sleduyushiyUroven();

                        nozh.y = startNozhY;
                        updateHUD();
                    }
                }
            }

            if (eb && Math.random() < 0.008) {
                skorostArbuza = -skorostArbuza;
            }

            ugolArbuza += skorostArbuza * ss.slow * deltaTime * 60;
        }

        for (var oi = oskolki.length - 1; oi >= 0; oi--) {
            var o = oskolki[oi];
            o.x += o.vx * deltaTime * 60;
            o.y += o.vy * deltaTime * 60;
            o.vy += 0.8 * deltaTime * 60;
            o.zhizn -= o.skorostIscheznoveniya * deltaTime * 60;

            if (o.zhizn > 0) {
                kist.globalAlpha = Math.max(0, o.zhizn);
                kist.fillStyle = o.cvet;
                kist.beginPath();
                kist.arc(o.x, o.y, o.razmer, 0, Math.PI * 2);
                kist.fill();
                kist.globalAlpha = 1;
            } else {
                oskolki.splice(oi, 1);
            }
        }

        var an = kartinkiOruzhiya[vybrannyiSkinId];
        var am = poluchitKartinkuMisheni();

        if (meteor.aktiven) {
            kist.save();
            kist.translate(mx, my);
            kist.rotate(meteor.ugol * 3);
            kist.drawImage(kartinkaMeteor, -meteor.razmer, -meteor.razmer, meteor.razmer * 2, meteor.razmer * 2);
            kist.restore();
        }

        kist.save();
        kist.translate(arbuz.x, arbuz.y);
        kist.rotate(ugolArbuza);

        for (var vi = 0; vi < vteknutieNozhi.length; vi++) {
            kist.save();
            kist.rotate(vteknutieNozhi[vi]);
            if (an) kist.drawImage(an, -nozh.shirina / 2, tr - 30, nozh.shirina, nozh.vysota);
            kist.restore();
        }

        if (am) kist.drawImage(am, -tr, -tr, tr * 2, tr * 2);

        for (var yi = 0; yi < yablokiNaArbuze.length; yi++) {
            kist.save();
            kist.rotate(yablokiNaArbuze[yi]);
            kist.translate(0, tr + 30);
            kist.rotate(Math.PI);
            kist.drawImage(kartinkaYabloko, -50, -50, 100, 100);
            kist.restore();
        }

        for (var bi = 0; bi < bronyaNaArbuze.length; bi++) {
            kist.save();
            kist.rotate(bronyaNaArbuze[bi]);
            kist.translate(0, tr + 20);
            kist.rotate(Math.PI);
            kist.drawImage(kartinkaBronya, -25, -25, 50, 50);
            kist.restore();
        }

        kist.restore();

        if ((sostoyanieIgry === "PLAY" || sostoyanieIgry === "GAMEOVER") && ostalosNozhei > 0 && padayushiyNozh === null && an) {
            kist.drawImage(an, nozh.x - nozh.shirina / 2, nozh.y, nozh.shirina, nozh.vysota);
        }

        if (padayushiyNozh && an) {
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

        for (var ti = vsplyvayushieTeksty.length - 1; ti >= 0; ti--) {
            var v = vsplyvayushieTeksty[ti];
            v.y += v.vy * deltaTime * 60;
            v.zhizn -= 0.02 * deltaTime * 60;

            if (v.zhizn > 0) {
                kist.globalAlpha = Math.max(0, v.zhizn);
                kist.fillStyle = "#FFD700";
                kist.font = "bold 40px Arial";
                kist.textAlign = "center";
                kist.fillText(v.text, v.x, v.y);
                kist.globalAlpha = 1;
            } else {
                vsplyvayushieTeksty.splice(ti, 1);
            }
        }

        kist.restore();

        if (krasnayaVspyshka > 0) {
            kist.fillStyle = 'rgba(255,0,0,' + krasnayaVspyshka + ')';
            kist.fillRect(0, 0, holst.width, holst.height);
            krasnayaVspyshka -= 0.02 * deltaTime * 60;
        }
    }

    function initGame() {
        loadVkBridge(function(bridge) {
            if (bridge) {
                PlatformAdapter.vkBridge = bridge;
                PlatformAdapter.platform = 'vk';
                adLog('Bridge manually assigned');
            } else {
                PlatformAdapter.platform = 'web';
                adLog('Bridge not loaded → web mode');
            }

            PlatformAdapter.init().then(function() {
                var savedLang = null;
                try {
                    savedLang = localStorage.getItem('vk_snaiper_lang');
                } catch (e) {}

                var detectedLang = PlatformAdapter.getLanguage();
                currentLang = (savedLang === 'ru' || savedLang === 'en') ? savedLang : detectedLang;

                sozdatSharKnopki();
                applyLanguage();

                PlatformAdapter.signalReady();
                PlatformAdapter.preloadAds();

                nastroikaEkrana();
                loadDataFromAdapter();
                loadAudioFiles();

                setTimeout(finishLoading, 8000);
            });
        });
    }

    window.addEventListener("resize", forceResize);
    window.addEventListener("orientationchange", function() {
        setTimeout(forceResize, 100);
    });

    if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', forceResize);
        window.visualViewport.addEventListener('scroll', forceResize);
    }

    window.addEventListener("load", function() {
        setTimeout(forceResize, 100);
        setTimeout(forceResize, 500);
        setTimeout(forceResize, 1000);
        initGame();
    });

    nastroikaEkrana();
})();
