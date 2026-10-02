/**
 * ==========================================================================
 * DigiClock - モーフィングデジタルクロック コアスクリプト
 * 
 * ユーザが作成した数字のモーフィング素材（30fps / 500x500px）を
 * 透過動画（WebM/MP4）または連番画像（PNG）で高精度同期再生するエンジン
 * ==========================================================================
 */

/* ==========================================================================
   【ユーザ向け設定エリア】
   自分の制作環境や書き出し設定に合わせて、以下の項目を確認・変更してください。
   ========================================================================== */
const ASSET_CONFIG = {
  // デフォルトの素材モード: 'webm' (透過動画) または 'png' (連番画像)
  defaultMode: 'webm',

  // 1秒間のフレーム数（授業規格: 30fps）
  fps: 30,

  // 素材の解像度（授業規格: 500x500px）
  width: 500,
  height: 500,

  // ------------------------------------------------------------------------
  // ① 透過動画モード (WebM / 透過MP4) の設定
  // ------------------------------------------------------------------------
  // 【配置場所】: assets/webm/
  // 【ファイル名ルール】: {from}_to_{to}.webm  (例: 0_to_1.webm, 9_to_0.webm)
  webm: {
    basePath: 'assets/webm/',
    fileExtension: '.webm',
    patterns: [
      '0_to_1', '1_to_2', '2_to_3', '3_to_4', '4_to_5',
      '5_to_6', '6_to_7', '7_to_8', '8_to_9', '9_to_0',
      '5_to_0', // 秒・分の十の位（未作成時は 9_to_0 が代替されます）
      '2_to_0', // 時の十の位（未作成時は 9_to_0 が代替されます）
    ]
  },

  // ------------------------------------------------------------------------
  // ② 連番画像モード (PNG) の設定
  // ------------------------------------------------------------------------
  // 【配置場所】: assets/png/{from}_to_{to}/
  // 【ファイル名ルール】: assets/png/0_to_1/frame_00.png 〜 frame_29.png (計30フレーム)
  png: {
    basePath: 'assets/png/',
    prefix: 'frame_',
    padLength: 2,           // 桁数（2なら 00, 01... / 3なら 000, 001...）
    startIndex: 0,          // 開始番号（0始まり）
    fileExtension: '.png',
    patterns: [
      '0_to_1', '1_to_2', '2_to_3', '3_to_4', '4_to_5',
      '5_to_6', '6_to_7', '7_to_8', '8_to_9', '9_to_0',
      '5_to_0',
      '2_to_0',
    ]
  }
};


/* ==========================================================================
   サウンド管理システム (Web Audio API & オーディオファイル)
   秒（アナログ・デジタル・カスタム）
   分（アナログ・デジタル・カスタム）
   時（ごーんごーん・ぽっぽぽっぽ・カスタム）
   ========================================================================== */
class SoundEngine {
  constructor() {
    this.audioCtx = null;
    this.customBuffers = {
      sec: null,
      min: null,
      hour: null
    };
    this.customFiles = {
      sec: null,
      min: null,
      hour: null
    };
    this.volume = 0.7; // 0.0 〜 1.0
  }

  ensureContext() {
    if (!this.audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        this.audioCtx = new AudioContextClass();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }
  }

  /**
   * ユーザー操作（クリック、タップ、キー等）時に明示的にAudioContextをアンロック
   */
  unlock() {
    this.ensureContext();
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }
  }

  isReady() {
    return this.audioCtx && this.audioCtx.state === 'running';
  }

  setVolume(vol) {
    this.volume = Math.max(0, Math.min(1, vol));
  }

  setCustomAudio(tier, file) {
    this.customFiles[tier] = file;
    this.ensureContext();
    const reader = new FileReader();
    reader.onload = (e) => {
      if (this.audioCtx) {
        this.audioCtx.decodeAudioData(e.target.result, (buf) => {
          this.customBuffers[tier] = buf;
        });
      }
    };
    reader.readAsArrayBuffer(file);
  }

  /**
   * ① 秒の音（毎秒）
   */
  playSecSound(type = 'analog') {
    if (type === 'none' || this.volume <= 0) return;
    this.ensureContext();
    if (!this.audioCtx || this.audioCtx.state !== 'running') return;

    if (type === 'custom' && this.customBuffers.sec) {
      this._playBuffer(this.customBuffers.sec);
      return;
    }

    const ctx = this.audioCtx;
    const now = ctx.currentTime;

    if (type === 'analog') {
      // アナログ秒針（カチッ・コチッ：短いアタック + バンドパス）
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();
      
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(1600, now);
      osc.frequency.exponentialRampToValueAtTime(120, now + 0.025);

      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(2200, now);

      gain.gain.setValueAtTime(0.5 * this.volume, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.035);
    } else if (type === 'digital') {
      // デジタル秒針音（ピッ：高域サイン波パルス）
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1400, now);
      gain.gain.setValueAtTime(0.3 * this.volume, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.045);
    }
  }

  /**
   * ② 分の音（毎分00秒）
   */
  playMinSound(type = 'digital') {
    if (type === 'none' || this.volume <= 0) return;
    this.ensureContext();
    if (!this.audioCtx || this.audioCtx.state !== 'running') return;

    if (type === 'custom' && this.customBuffers.min) {
      this._playBuffer(this.customBuffers.min);
      return;
    }

    const ctx = this.audioCtx;
    const now = ctx.currentTime;

    if (type === 'analog') {
      // アナログ時計の分送り音（少し重厚なカチャッ）
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = 'triangle';
      osc1.frequency.setValueAtTime(800, now);
      osc1.frequency.exponentialRampToValueAtTime(100, now + 0.05);

      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(450, now + 0.01);
      osc2.frequency.exponentialRampToValueAtTime(80, now + 0.06);

      gain.gain.setValueAtTime(0.7 * this.volume, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc1.start(now);
      osc2.start(now + 0.01);
      osc1.stop(now + 0.08);
      osc2.stop(now + 0.08);
    } else if (type === 'digital') {
      // デジタル報時音（ピピッ！2音連続）
      this._playBeepTone(1318.5, now, 0.05);          // E6
      this._playBeepTone(1567.98, now + 0.07, 0.07);  // G6
    }
  }

  /**
   * ③ 時の音（毎時00分00秒）
   */
  playHourSound(type = 'bell') {
    if (type === 'none' || this.volume <= 0) return;
    this.ensureContext();
    if (!this.audioCtx || this.audioCtx.state !== 'running') return;

    if (type === 'custom' && this.customBuffers.hour) {
      this._playBuffer(this.customBuffers.hour);
      return;
    }

    const ctx = this.audioCtx;
    const now = ctx.currentTime;

    if (type === 'bell') {
      // ごーんごーん（鐘の音：豊かな低周波倍音 + 長い余韻、2回打鐘）
      this._strikeBell(now);
      this._strikeBell(now + 1.4);
    } else if (type === 'cuckoo') {
      // ぽっぽぽっぽ（鳩時計：ポッ・ポーを2回繰り返し）
      this._playCuckooPair(now);
      this._playCuckooPair(now + 0.7);
    }
  }

  _playBeepTone(freq, startTime, duration) {
    const ctx = this.audioCtx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, startTime);
    gain.gain.setValueAtTime(0.35 * this.volume, startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(startTime);
    osc.stop(startTime + duration + 0.01);
  }

  _strikeBell(startTime) {
    const ctx = this.audioCtx;
    // 鐘の倍音構成 (非調和倍音)
    const partials = [
      { freq: 130.81, gain: 0.6, decay: 2.5 },  // C3基音
      { freq: 261.63, gain: 0.4, decay: 2.0 },  // C4
      { freq: 392.00, gain: 0.25, decay: 1.6 }, // G4
      { freq: 523.25, gain: 0.15, decay: 1.2 }, // C5
      { freq: 659.25, gain: 0.08, decay: 0.8 }  // E5
    ];

    partials.forEach(p => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(p.freq, startTime);
      gain.gain.setValueAtTime(p.gain * this.volume, startTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + p.decay);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(startTime);
      osc.stop(startTime + p.decay + 0.05);
    });
  }

  _playCuckooPair(startTime) {
    const ctx = this.audioCtx;
    // ポッ (高音: F#5 約 740Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(740, startTime);
    gain1.gain.setValueAtTime(0.55 * this.volume, startTime);
    gain1.gain.exponentialRampToValueAtTime(0.001, startTime + 0.18);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(startTime);
    osc1.stop(startTime + 0.2);

    // ポー (低音: D5 約 587Hz)
    const t2 = startTime + 0.22;
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(587, t2);
    gain2.gain.setValueAtTime(0.5 * this.volume, t2);
    gain2.gain.exponentialRampToValueAtTime(0.001, t2 + 0.35);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(t2);
    osc2.stop(t2 + 0.38);
  }

  _playBuffer(buffer) {
    const ctx = this.audioCtx;
    const source = ctx.createBufferSource();
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(this.volume, ctx.currentTime);
    source.buffer = buffer;
    source.connect(gain);
    gain.connect(ctx.destination);
    source.start(ctx.currentTime);
  }
}


/* ==========================================================================
   アセット管理クラス
   ========================================================================== */
class AssetManager {
  constructor(config) {
    this.config = config;
    this.currentMode = config.defaultMode;
    this.cache = {
      png: {},
      webm: {}
    };
    this.status = {
      png: {},
      webm: {}
    };
    this.blobOverrides = {
      png: {},
      webm: {}
    };
    this.rawFiles = {
      png: {},
      webm: {}
    };
    this.onProgressCallback = null;
  }

  setMode(mode) {
    if (this.currentMode !== mode) {
      this.currentMode = mode;
      return true;
    }
    return false;
  }

  getMode() {
    return this.currentMode;
  }

  /**
   * フォルダ選択ダイアログやZIP展開から受け取ったFileListをメモリ内アセットとして登録
   * フォルダ内に digiclock_config.json 等の設定ファイルが含まれている場合は自動解析して返す
   */
  async loadFromFolderFiles(fileList) {
    let webmCount = 0;
    let pngCount = 0;
    let detectedConfig = null;

    for (const file of fileList) {
      const relPath = file.fullPathEntry || file.webkitRelativePath || file.name;
      const lowerName = file.name.toLowerCase();

      // JSON設定ファイルがあれば自動検出して解析
      if (lowerName.endsWith('.json') && !detectedConfig) {
        try {
          const text = await file.text();
          detectedConfig = JSON.parse(text);
        } catch (_) {}
      }

      // 背景や音声は数字アニメーション素材から除外
      const lowerRel = relPath.toLowerCase();
      if (lowerRel.includes('/bg/') || lowerRel.includes('assets/bg/') || lowerName.startsWith('bg_') || lowerName.startsWith('background') ||
          lowerRel.includes('/sounds/') || lowerName.startsWith('sec_') || lowerName.startsWith('min_') || lowerName.startsWith('hour_')) {
        continue;
      }

      // webm / mp4 のマッチ (例: .../0_to_1.webm)
      if (relPath.endsWith('.webm') || relPath.endsWith('.mp4')) {
        const fileName = file.name.replace(/\.[^.]+$/, '');
        const blobUrl = URL.createObjectURL(file);
        this.blobOverrides.webm[fileName] = blobUrl;
        this.rawFiles.webm[fileName] = file;
        webmCount++;
      }
      // png のマッチ (例: .../0_to_1/frame_00.png)
      if (relPath.endsWith('.png')) {
        const normalized = relPath.replace(/\\/g, '/');
        const parts = normalized.split('/');
        if (parts.length >= 2) {
          const folderName = parts[parts.length - 2];
          if (!this.blobOverrides.png[folderName]) {
            this.blobOverrides.png[folderName] = [];
            this.rawFiles.png[folderName] = [];
          }
          this.blobOverrides.png[folderName].push({
            name: file.name,
            file: file,
            blobUrl: URL.createObjectURL(file)
          });
          this.rawFiles.png[folderName].push(file);
          pngCount++;
        }
      }
    }

    // 自動モード判定
    if (webmCount > 0 && pngCount === 0) {
      this.currentMode = 'webm';
    } else if (pngCount > 0 && webmCount === 0) {
      this.currentMode = 'png';
    }
    return { 
      webmCount, 
      pngCount, 
      total: webmCount + pngCount, 
      detectedMode: this.currentMode,
      detectedConfig 
    };
  }

  /**
   * ユーザから提供されたアセット（フォルダ選択やドロップ）が存在するか
   */
  hasCustomAssets() {
    return Object.keys(this.blobOverrides.webm).length > 0 || Object.keys(this.blobOverrides.png).length > 0;
  }

  async preloadAll(onProgress) {
    this.onProgressCallback = onProgress;
    const mode = this.currentMode;

    // ユーザがまだ素材を読み込んでおらず、かつサーバー上に静的素材がない初期状態では
    // 存在しないURLへのHTTPリクエスト（404エラー）を一切発生させず、直ちに全パターンを未配置（ダミー描画）として完了する
    if (!this.hasCustomAssets()) {
      const patterns = mode === 'webm' ? this.config.webm.patterns : this.config.png.patterns;
      patterns.forEach(p => {
        this.status[mode][p] = 'missing';
      });
      if (this.onProgressCallback) {
        this.onProgressCallback(patterns.length, patterns.length, patterns[patterns.length - 1], false);
      }
      return this.status[mode];
    }

    if (mode === 'webm') {
      return await this._preloadWebM();
    } else {
      return await this._preloadPNG();
    }
  }

  async _preloadWebM() {
    const patterns = this.config.webm.patterns;
    let completedCount = 0;
    const total = patterns.length;

    const promises = patterns.map(pattern => {
      return new Promise(async (resolve) => {
        const isOverride = Boolean(this.blobOverrides.webm[pattern]);
        let url = isOverride 
          ? this.blobOverrides.webm[pattern] 
          : `${this.config.webm.basePath}${pattern}${this.config.webm.fileExtension}`;

        // 静的パスの場合は事前にfetch (HEAD) で存在確認を行い、404エラーをブラウザコンソールに出さない
        if (!isOverride) {
          try {
            const headResp = await fetch(url, { method: 'HEAD' });
            if (!headResp.ok) {
              this.status.webm[pattern] = 'missing';
              completedCount++;
              if (this.onProgressCallback) this.onProgressCallback(completedCount, total, pattern, false);
              return resolve({ pattern, success: false });
            }
          } catch (_) {
            this.status.webm[pattern] = 'missing';
            completedCount++;
            if (this.onProgressCallback) this.onProgressCallback(completedCount, total, pattern, false);
            return resolve({ pattern, success: false });
          }
        }

        const video = document.createElement('video');
        video.crossOrigin = 'anonymous';
        video.preload = 'auto';
        video.muted = true;
        video.playsInline = true;
        video.setAttribute('playsinline', '');
        video.setAttribute('muted', '');
        
        let isSettled = false;
        const handleSuccess = () => {
          if (isSettled) return;
          isSettled = true;
          this.cache.webm[pattern] = video;
          this.status.webm[pattern] = 'loaded';
          completedCount++;
          if (this.onProgressCallback) this.onProgressCallback(completedCount, total, pattern, true);
          resolve({ pattern, success: true });
        };

        const handleError = () => {
          if (isSettled) return;
          isSettled = true;
          this.status.webm[pattern] = 'missing';
          completedCount++;
          if (this.onProgressCallback) this.onProgressCallback(completedCount, total, pattern, false);
          resolve({ pattern, success: false });
        };

        video.addEventListener('canplaythrough', handleSuccess, { once: true });
        video.addEventListener('loadeddata', handleSuccess, { once: true });
        video.addEventListener('error', handleError, { once: true });

        setTimeout(() => {
          if (!isSettled) {
            if (video.readyState >= 2) {
              handleSuccess();
            } else {
              handleError();
            }
          }
        }, 2500);

        video.src = url;
        video.load();
      });
    });

    await Promise.all(promises);
    return this.status.webm;
  }

  async _preloadPNG() {
    const patterns = this.config.png.patterns;
    const fps = this.config.fps;
    let completedPatterns = 0;
    const total = patterns.length;

    const patternPromises = patterns.map(pattern => {
      return new Promise(async (resolvePattern) => {
        // フォルダ直読込のオーバーライドがあるか確認
        const overrideList = this.blobOverrides.png[pattern];
        const isOverride = Boolean(overrideList && overrideList.length > 0);

        if (isOverride) {
          overrideList.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
        } else {
          // 静的パスの場合は最初のフレーム frame_00.png の存在をHEADで事前確認
          const testUrl = `${this.config.png.basePath}${pattern}/${this.config.png.prefix}00${this.config.png.fileExtension}`;
          try {
            const headResp = await fetch(testUrl, { method: 'HEAD' });
            if (!headResp.ok) {
              this.status.png[pattern] = 'missing';
              completedPatterns++;
              if (this.onProgressCallback) this.onProgressCallback(completedPatterns, total, pattern, false);
              return resolvePattern({ pattern, success: false });
            }
          } catch (_) {
            this.status.png[pattern] = 'missing';
            completedPatterns++;
            if (this.onProgressCallback) this.onProgressCallback(completedPatterns, total, pattern, false);
            return resolvePattern({ pattern, success: false });
          }
        }

        const frameImages = [];
        let loadedFrames = 0;
        let hasError = false;
        const framePromises = [];

        for (let i = 0; i < fps; i++) {
          let url = '';
          if (isOverride && overrideList[i]) {
            url = overrideList[i].blobUrl;
          } else {
            const frameIndex = this.config.png.startIndex + i;
            const paddedIndex = String(frameIndex).padStart(this.config.png.padLength, '0');
            const fileName = `${this.config.png.prefix}${paddedIndex}${this.config.png.fileExtension}`;
            url = `${this.config.png.basePath}${pattern}/${fileName}`;
          }

          const p = new Promise(resolveFrame => {
            const img = new Image();
            img.onload = () => {
              if ('decode' in img) {
                img.decode().then(() => {
                  loadedFrames++;
                  resolveFrame(true);
                }).catch(() => {
                  loadedFrames++;
                  resolveFrame(true);
                });
              } else {
                loadedFrames++;
                resolveFrame(true);
              }
            };
            img.onerror = () => {
              hasError = true;
              resolveFrame(false);
            };
            img.src = url;
            frameImages[i] = img;
          });
          framePromises.push(p);
        }

        await Promise.all(framePromises);

        completedPatterns++;
        if (hasError || loadedFrames === 0) {
          this.status.png[pattern] = 'missing';
          if (this.onProgressCallback) this.onProgressCallback(completedPatterns, total, pattern, false);
          resolvePattern({ pattern, success: false });
        } else {
          this.cache.png[pattern] = frameImages;
          this.status.png[pattern] = 'loaded';
          if (this.onProgressCallback) this.onProgressCallback(completedPatterns, total, pattern, true);
          resolvePattern({ pattern, success: true });
        }
      });
    });

    await Promise.all(patternPromises);
    return this.status.png;
  }

  getAsset(pattern) {
    const mode = this.currentMode;
    const targetCache = this.cache[mode];

    if (targetCache && targetCache[pattern]) {
      return { asset: targetCache[pattern], pattern: pattern, isFallback: false };
    }

    if (pattern === '5_to_0' || pattern === '2_to_0') {
      if (targetCache && targetCache['9_to_0']) {
        return { asset: targetCache['9_to_0'], pattern: '9_to_0', isFallback: true };
      }
    }

    return null;
  }
}


/* ==========================================================================
   各桁（時1, 時2, 分1, 分2, 秒1, 秒2）の描画管理クラス
   ========================================================================== */
class DigitRenderer {
  constructor(containerEl, assetManager, digitId, soundEngine) {
    this.container = containerEl;
    this.canvas = containerEl.querySelector('.digit-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.assetManager = assetManager;
    this.digitId = digitId;
    this.soundEngine = soundEngine;

    this.width = ASSET_CONFIG.width;
    this.height = ASSET_CONFIG.height;
    this.canvas.width = this.width;
    this.canvas.height = this.height;

    this.currentValue = 0;
    this.isAnimating = false;
    this.transitionFrom = 0;
    this.transitionTo = 0;
    this.animStartTime = 0;
    this.animDuration = 1000;

    this.activeVideo = null;
    this.activeAssetPattern = null;
    this.enableFallbackDummy = true;
    this.playVideoAudio = false;

    this.drawStatic(this.currentValue);
  }

  startTransition(fromVal, toVal) {
    this.transitionFrom = fromVal;
    this.transitionTo = toVal;
    this.currentValue = toVal;
    this.isAnimating = true;
    this.animStartTime = performance.now();

    const patternName = `${fromVal}_to_${toVal}`;
    const mode = this.assetManager.getMode();
    const assetData = this.assetManager.getAsset(patternName);

    if (mode === 'webm') {
      if (assetData && assetData.asset) {
        if (!this.activeVideo) {
          this.activeVideo = document.createElement('video');
          this.activeVideo.playsInline = true;
          this.activeVideo.setAttribute('playsinline', '');
        } else {
          this.activeVideo.pause();
        }

        this.activeVideo.muted = !this.playVideoAudio;
        if (this.playVideoAudio) {
          this.activeVideo.volume = this.soundEngine.volume;
        }

        if (this.activeVideo.src !== assetData.asset.src) {
          this.activeVideo.src = assetData.asset.src;
        }
        this.activeVideo.currentTime = 0;
        this.activeVideo.play().catch(() => {});
        this.activeAssetPattern = assetData.pattern;
      } else {
        if (this.activeVideo) {
          this.activeVideo.pause();
          this.activeVideo = null;
        }
        this.activeAssetPattern = null;
      }
    } else {
      if (this.activeVideo) {
        this.activeVideo.pause();
        this.activeVideo = null;
      }
    }
  }

  update(nowTime) {
    if (!this.isAnimating) return;

    const elapsed = nowTime - this.animStartTime;
    const progress = Math.min(1.0, Math.max(0, elapsed / this.animDuration));

    const patternName = `${this.transitionFrom}_to_${this.transitionTo}`;
    const mode = this.assetManager.getMode();
    const assetData = this.assetManager.getAsset(patternName);

    this.ctx.clearRect(0, 0, this.width, this.height);

    let hasDrawn = false;
    if (assetData) {
      if (mode === 'webm') {
        if (this.activeVideo && this.activeVideo.readyState >= 2) {
          this.ctx.drawImage(this.activeVideo, 0, 0, this.width, this.height);
          hasDrawn = true;
        }
      } else {
        const frames = assetData.asset;
        if (frames && frames.length > 0) {
          const totalFrames = frames.length;
          const frameIndex = Math.min(totalFrames - 1, Math.floor(progress * totalFrames));
          const img = frames[frameIndex];
          if (img && img.complete && img.naturalWidth > 0) {
            this.ctx.drawImage(img, 0, 0, this.width, this.height);
            hasDrawn = true;
          }
        }
      }
    }

    if (!hasDrawn) {
      if (this.enableFallbackDummy) {
        this._drawFallbackMorph(this.transitionFrom, this.transitionTo, progress);
      } else {
        this._drawFallbackStatic(this.transitionTo);
      }
    }

    if (progress >= 1.0) {
      this.isAnimating = false;
      if (this.activeVideo) {
        this.activeVideo.pause();
      }
      this.drawStatic(this.transitionTo, true);
    }
  }

  drawStatic(value, keepCurrentCanvas = false) {
    this.currentValue = value;
    this.isAnimating = false;

    // アニメーション完了直後で、既にキャンバスに最終フレームが描画されている場合は再クリアしない
    if (keepCurrentCanvas) {
      return;
    }

    if (this.activeVideo) {
      this.activeVideo.pause();
      this.activeVideo = null;
    }
    this.ctx.clearRect(0, 0, this.width, this.height);

    const mode = this.assetManager.getMode();
    const prevPattern = value === 0 ? '9_to_0' : `${value - 1}_to_${value}`;
    const assetData = this.assetManager.getAsset(prevPattern);

    if (assetData) {
      if (mode === 'png') {
        const frames = assetData.asset;
        if (frames && frames.length > 0) {
          const lastFrame = frames[frames.length - 1];
          if (lastFrame && lastFrame.complete && lastFrame.naturalWidth > 0) {
            this.ctx.drawImage(lastFrame, 0, 0, this.width, this.height);
            return;
          }
        }
      }
    }

    // WebMまたは静的素材未配置時は確実にテキスト数字を描画し、決して空白にしない
    this._drawFallbackStatic(value);
  }

  _drawFallbackMorph(fromVal, toVal, progress) {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;
    const p = Math.max(0, Math.min(1.0, progress));
    // 滑らかなイージング（easeInOutQuad）
    const ease = p < 0.5 ? 2 * p * p : -1 + (4 - 2 * p) * p;

    ctx.save();
    ctx.font = 'bold 340px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const fromOpacity = Math.max(0, 1 - ease);
    const toOpacity = Math.min(1, ease);

    // 遷移元数字のフェードアウト & 上部へスライド
    if (fromOpacity > 0.02) {
      ctx.fillStyle = `rgba(240, 244, 248, ${fromOpacity * 0.95})`;
      ctx.fillText(String(fromVal), w / 2, h / 2 - ease * 60);
    }

    // 遷移先数字のフェードイン & 下部からスライド
    if (toOpacity > 0.02) {
      ctx.fillStyle = `rgba(240, 244, 248, ${toOpacity * 0.95})`;
      ctx.fillText(String(toVal), w / 2, h / 2 + (1 - ease) * 60);
    }

    ctx.restore();
  }

  _drawFallbackStatic(value) {
    const ctx = this.ctx;
    ctx.save();
    ctx.font = 'bold 340px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(240, 244, 248, 0.95)';
    ctx.fillText(String(value), this.width / 2, this.height / 2);
    ctx.restore();
  }
}


/* ==========================================================================
   クロック全体制御 & UIマネージャー
   ========================================================================== */
class ClockApp {
  constructor() {
    this.soundEngine = new SoundEngine();
    this.assetManager = new AssetManager(ASSET_CONFIG);
    this.digitRenderers = [];
    this.lastDigits = [-1, -1, -1, -1, -1, -1];
    this.lastSec = -1;

    this.opMode = 'clock';
    this.testValue = 0;
    this.testInterval = null;

    // 音声設定状態
    this.enableTickSound = false;
    this.soundType = 'click';

    this.initDOM();
    this.initDigits();
    this.bindEvents();
    this.loadSavedConfig();
    this.startPreload();
    this.startMainLoop();
  }

  initDOM() {
    this.clockContainer = document.getElementById('clock-container');
    this.settingsPanel = document.getElementById('settings-panel');
    this.btnToggleSettings = document.getElementById('btn-toggle-settings');
    this.btnCloseSettings = document.getElementById('btn-close-settings');
    this.toast = document.getElementById('status-toast');
    this.dragDropOverlay = document.getElementById('drag-drop-overlay');

    // アセット関連
    this.radioWebm = document.getElementById('mode-webm');
    this.radioPng = document.getElementById('mode-png');
    this.modeHelpText = document.getElementById('mode-help-text');
    this.btnReloadAssets = document.getElementById('btn-reload-assets');
    this.btnOpenFolder = document.getElementById('btn-open-folder');
    this.inputFolderPicker = document.getElementById('input-folder-picker');
    this.preloadProgressBar = document.getElementById('preload-progress-bar');
    this.preloadStatusText = document.getElementById('preload-status-text');
    this.assetPatternList = document.getElementById('asset-pattern-list');

    // 動作モード
    this.btnModeClock = document.getElementById('btn-mode-clock');

    // 表示オプション・間隔スライダー
    this.rngScale = document.getElementById('rng-scale');
    this.txtScaleValue = document.getElementById('txt-scale-value');
    this.rngDigitGap = document.getElementById('rng-digit-gap');
    this.txtDigitGapValue = document.getElementById('txt-digit-gap-value');
    this.rngColonMargin = document.getElementById('rng-colon-margin');
    this.txtColonMarginValue = document.getElementById('txt-colon-margin-value');
    this.chkBlinkColon = document.getElementById('chk-blink-colon');
    this.chkFallback = document.getElementById('chk-fallback');
    this.chkGuidelines = document.getElementById('chk-guidelines');
    this.colons = document.querySelectorAll('.separator-colon');

    // 背景・テーマ
    this.pickerBgColor = document.getElementById('picker-bg-color');
    this.pickerColonColor = document.getElementById('picker-colon-color');
    this.inputBgFile = document.getElementById('input-bg-file');
    this.btnClearBg = document.getElementById('btn-clear-bg');
    this.txtBgFilename = document.getElementById('txt-bg-filename');
    this.bgVideo = document.getElementById('bg-video');
    this.bgImage = document.getElementById('bg-image');
    this.rngBgDim = document.getElementById('rng-bg-dim');
    this.txtBgDimValue = document.getElementById('txt-bg-dim-value');
    this.rngBgBlur = document.getElementById('rng-bg-blur');
    this.txtBgBlurValue = document.getElementById('txt-bg-blur-value');

    // 音（サウンド）秒・分・時
    this.chkVideoSound = document.getElementById('chk-video-sound');
    this.rngVolume = document.getElementById('rng-volume');
    this.txtVolumeValue = document.getElementById('txt-volume-value');

    this.selectSoundSec = document.getElementById('select-sound-sec');
    this.selectSoundMin = document.getElementById('select-sound-min');
    this.selectSoundHour = document.getElementById('select-sound-hour');

    this.btnPreviewSec = document.getElementById('btn-preview-sec');
    this.btnPreviewMin = document.getElementById('btn-preview-min');
    this.btnPreviewHour = document.getElementById('btn-preview-hour');

    this.uploadSec = document.getElementById('upload-sec');
    this.uploadMin = document.getElementById('upload-min');
    this.uploadHour = document.getElementById('upload-hour');

    this.inputSoundSec = document.getElementById('input-sound-sec');
    this.inputSoundMin = document.getElementById('input-sound-min');
    this.inputSoundHour = document.getElementById('input-sound-hour');

    this.txtSoundSecName = document.getElementById('txt-sound-sec-name');
    this.txtSoundMinName = document.getElementById('txt-sound-min-name');
    this.txtSoundHourName = document.getElementById('txt-sound-hour-name');

    // 12パターンテスト再生ボタン群
    this.btnPatTests = document.querySelectorAll('.btn-pat-test');

    // 音色状態の保持
    this.soundSecType = 'analog';
    this.soundMinType = 'none';
    this.soundHourType = 'none';

    // 保存・読込・共有
    this.btnExportPackage = document.getElementById('btn-export-package');
    this.inputImportPackage = document.getElementById('input-import-package');
    this.btnCopyShareUrl = document.getElementById('btn-copy-share-url');
    this.btnExportConfig = document.getElementById('btn-export-config');
    this.inputImportConfig = document.getElementById('input-import-config');
    this.btnResetConfig = document.getElementById('btn-reset-config');
    this.customBgFile = null;
  }

  initDigits() {
    const digitElements = [
      document.querySelector('[data-digit="h1"]'),
      document.querySelector('[data-digit="h2"]'),
      document.querySelector('[data-digit="m1"]'),
      document.querySelector('[data-digit="m2"]'),
      document.querySelector('[data-digit="s1"]'),
      document.querySelector('[data-digit="s2"]'),
    ];

    this.digitRenderers = digitElements.map((el, idx) => {
      return new DigitRenderer(el, this.assetManager, `digit_${idx}`, this.soundEngine);
    });
  }

  bindEvents() {
    // ユーザー操作時にAudioContextをアンロック（Web Audio 自動再生ポリシー対応）
    const unlockAudio = () => {
      this.soundEngine.unlock();
      ['pointerdown', 'touchstart', 'mousedown', 'keydown'].forEach(evt => {
        window.removeEventListener(evt, unlockAudio);
      });
    };
    ['pointerdown', 'touchstart', 'mousedown', 'keydown'].forEach(evt => {
      window.addEventListener(evt, unlockAudio, { passive: true });
    });

    // 時計開発室パネル開閉
    this.btnToggleSettings.addEventListener('click', () => {
      const isOpen = this.settingsPanel.classList.toggle('open');
      document.body.classList.toggle('settings-open', isOpen);
    });
    this.btnCloseSettings.addEventListener('click', () => {
      this.settingsPanel.classList.remove('open');
      document.body.classList.remove('settings-open');
    });

    // 画面下部ドロップ案内ピル & 開発室内ドロップゾーンクリックで製品読込ダイアログ
    const dropPill = document.getElementById('drop-hint-pill');
    if (dropPill) {
      dropPill.addEventListener('click', () => {
        if (this.inputImportPackage) this.inputImportPackage.click();
      });
    }
    const labDropAssets = document.getElementById('lab-dropzone-assets');
    if (labDropAssets) {
      labDropAssets.addEventListener('click', () => {
        if (this.inputImportPackage) this.inputImportPackage.click();
      });
    }
    const labDropShare = document.getElementById('lab-dropzone-share');
    if (labDropShare) {
      labDropShare.addEventListener('click', () => {
        if (this.inputImportPackage) this.inputImportPackage.click();
      });
    }

    // タブナビゲーションの切り替え（プロパティが枠内にすっきり収まる）
    const tabBtns = document.querySelectorAll('.settings-tabs-nav .tab-btn');
    const tabPanes = document.querySelectorAll('.settings-tab-content-area .tab-pane');
    tabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const targetId = btn.dataset.tab;
        tabBtns.forEach(b => b.classList.remove('active'));
        tabPanes.forEach(p => p.classList.remove('active'));
        btn.classList.add('active');
        const targetPane = document.getElementById(targetId);
        if (targetPane) targetPane.classList.add('active');
      });
    });

    // モード切り替え (WebM / PNG)
    const handleModeChange = (mode) => {
      if (this.assetManager.setMode(mode)) {
        this.updateModeHelpText(mode);
        this.showToast(`素材形式を「${mode === 'webm' ? '透過動画 (WebM)' : '連番画像 (PNG)'}」に切り替えました`);
        this.startPreload();
      }
    };
    this.radioWebm.addEventListener('change', () => handleModeChange('webm'));
    this.radioPng.addEventListener('change', () => handleModeChange('png'));

    // フォルダを開くボタン
    this.btnOpenFolder.addEventListener('click', () => {
      this.handleOpenFolder();
    });

    // フォルダ直接選択読込
    this.inputFolderPicker.addEventListener('change', async (e) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        await this.processImportedFileList(files, '選択フォルダ');
      }
    });

    // 全画面ドラッグ＆ドロップ受付（フォルダ再帰解析・ZIP対応）
    let dragCounter = 0;
    window.addEventListener('dragenter', (e) => {
      e.preventDefault();
      dragCounter++;
      if (this.dragDropOverlay) this.dragDropOverlay.classList.add('drag-active');
    });

    window.addEventListener('dragleave', (e) => {
      e.preventDefault();
      dragCounter--;
      if (dragCounter <= 0) {
        dragCounter = 0;
        if (this.dragDropOverlay) this.dragDropOverlay.classList.remove('drag-active');
      }
    });

    window.addEventListener('dragover', (e) => {
      e.preventDefault();
    });

    window.addEventListener('drop', async (e) => {
      e.preventDefault();
      dragCounter = 0;
      if (this.dragDropOverlay) this.dragDropOverlay.classList.remove('drag-active');

      const files = e.dataTransfer.files;
      // 単一ZIPファイルのドロップを直接展開
      if (files && files.length === 1 && files[0].name.toLowerCase().endsWith('.zip')) {
        await this.importZipPackage(files[0]);
        return;
      }

      const items = e.dataTransfer.items;
      if (!items || items.length === 0) return;

      this.showToast('部品フォルダを解析中...');
      const scannedFiles = await this.scanFilesFromDataTransfer(items);
      if (scannedFiles.length > 0) {
        // ZIPファイルが含まれている場合
        const zipFile = scannedFiles.find(f => f.name.toLowerCase().endsWith('.zip'));
        if (zipFile) {
          await this.importZipPackage(zipFile);
          return;
        }

        await this.processImportedFileList(scannedFiles, 'ドロップ');
      } else {
        this.showToast('有効な部品素材が見つかりませんでした');
      }
    });

    // 再読み込みボタン
    this.btnReloadAssets.addEventListener('click', () => {
      this.showToast('部品アセットを再読み込みします...');
      this.startPreload();
    });

    // 動作モード切り替え（現在時刻に同期）
    if (this.btnModeClock) {
      this.btnModeClock.addEventListener('click', () => this.setOpMode('clock'));
    }

    // スケール調整
    this.rngScale.addEventListener('input', (e) => {
      const val = e.target.value;
      this.txtScaleValue.textContent = `${Math.round(val * 100)}%`;
      document.documentElement.style.setProperty('--clock-scale', val);
    });

    // 数字間隔調整
    this.rngDigitGap.addEventListener('input', (e) => {
      const val = e.target.value;
      this.txtDigitGapValue.textContent = `${val}px`;
      document.documentElement.style.setProperty('--digit-gap', `${val}px`);
    });

    // コロン間隔調整
    this.rngColonMargin.addEventListener('input', (e) => {
      const val = e.target.value;
      this.txtColonMarginValue.textContent = `${val}px`;
      document.documentElement.style.setProperty('--colon-margin', `${val}px`);
    });

    // コロン点滅
    this.chkBlinkColon.addEventListener('change', (e) => {
      this.colons.forEach(c => c.classList.toggle('blinking', e.target.checked));
    });
    if (this.chkBlinkColon.checked) {
      this.colons.forEach(c => c.classList.add('blinking'));
    }

    // ダミー描画
    this.chkFallback.addEventListener('change', (e) => {
      this.digitRenderers.forEach(r => r.enableFallbackDummy = e.target.checked);
    });

    // 枠線ガイド
    this.chkGuidelines.addEventListener('change', (e) => {
      this.clockContainer.classList.toggle('show-guidelines', e.target.checked);
    });

    // カラーピッカー
    this.pickerBgColor.addEventListener('input', (e) => {
      document.documentElement.style.setProperty('--bg-color', e.target.value);
    });
    this.pickerColonColor.addEventListener('input', (e) => {
      document.documentElement.style.setProperty('--colon-color', e.target.value);
      document.documentElement.style.setProperty('--colon-glow', e.target.value + '66');
    });

    // 背景メディア（画像 / 映像）選択
    this.inputBgFile.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;

      this.customBgFile = file;
      const fileUrl = URL.createObjectURL(file);
      this.txtBgFilename.textContent = file.name;
      this.btnClearBg.style.display = 'inline-block';

      if (file.type.startsWith('video/')) {
        this.bgImage.classList.remove('active');
        this.bgImage.src = '';
        this.bgVideo.src = fileUrl;
        this.bgVideo.classList.add('active');
        this.bgVideo.play().catch(() => {});
        this.showToast(`背景映像を設定しました: ${file.name}`);
      } else if (file.type.startsWith('image/')) {
        this.bgVideo.classList.remove('active');
        this.bgVideo.pause();
        this.bgVideo.src = '';
        this.bgImage.src = fileUrl;
        this.bgImage.classList.add('active');
        this.showToast(`背景画像を設定しました: ${file.name}`);
      }
    });

    // 背景メディア削除
    this.btnClearBg.addEventListener('click', () => {
      this.customBgFile = null;
      this.bgVideo.classList.remove('active');
      this.bgVideo.pause();
      this.bgVideo.src = '';
      this.bgImage.classList.remove('active');
      this.bgImage.src = '';
      this.inputBgFile.value = '';
      this.txtBgFilename.textContent = '未選択（単色背景）';
      this.btnClearBg.style.display = 'none';
      this.showToast('背景メディアを解除しました');
    });

    // 背景暗さスライダー
    this.rngBgDim.addEventListener('input', (e) => {
      const val = e.target.value;
      this.txtBgDimValue.textContent = `${val}%`;
      document.documentElement.style.setProperty('--bg-dim', val / 100);
    });

    // 背景ぼかしスライダー
    this.rngBgBlur.addEventListener('input', (e) => {
      const val = e.target.value;
      this.txtBgBlurValue.textContent = `${val}px`;
      document.documentElement.style.setProperty('--bg-blur', `${val}px`);
    });

    // 12パターンテスト再生ボタン群のバインド
    if (this.btnPatTests && this.btnPatTests.length > 0) {
      this.btnPatTests.forEach(btn => {
        btn.addEventListener('click', () => {
          const from = parseInt(btn.dataset.from, 10);
          const to = parseInt(btn.dataset.to, 10);
          this.playSinglePatternTest(from, to);
        });
      });
    }

    // 音（サウンド）設定
    this.chkVideoSound.addEventListener('change', (e) => {
      const isPlay = e.target.checked;
      this.digitRenderers.forEach(r => r.playVideoAudio = isPlay);
      this.showToast(`動画音声の再生を ${isPlay ? 'ON' : 'OFF'} にしました`);
    });

    // 秒音選択
    this.selectSoundSec.addEventListener('change', (e) => {
      this.soundEngine.unlock();
      this.soundSecType = e.target.value;
      this.uploadSec.style.display = this.soundSecType === 'custom' ? 'flex' : 'none';
      if (this.soundSecType !== 'none') {
        this.soundEngine.playSecSound(this.soundSecType);
      }
      this.saveToStorage();
    });

    // 分音選択
    this.selectSoundMin.addEventListener('change', (e) => {
      this.soundEngine.unlock();
      this.soundMinType = e.target.value;
      this.uploadMin.style.display = this.soundMinType === 'custom' ? 'flex' : 'none';
      if (this.soundMinType !== 'none') {
        this.soundEngine.playMinSound(this.soundMinType);
      }
      this.saveToStorage();
    });

    // 時音選択
    this.selectSoundHour.addEventListener('change', (e) => {
      this.soundEngine.unlock();
      this.soundHourType = e.target.value;
      this.uploadHour.style.display = this.soundHourType === 'custom' ? 'flex' : 'none';
      if (this.soundHourType !== 'none') {
        this.soundEngine.playHourSound(this.soundHourType);
      }
      this.saveToStorage();
    });

    // 試聴ボタン
    this.btnPreviewSec.addEventListener('click', () => {
      this.soundEngine.unlock();
      this.soundEngine.playSecSound(this.soundSecType);
    });

    this.btnPreviewMin.addEventListener('click', () => {
      this.soundEngine.unlock();
      this.soundEngine.playMinSound(this.soundMinType);
    });

    this.btnPreviewHour.addEventListener('click', () => {
      this.soundEngine.unlock();
      this.soundEngine.playHourSound(this.soundHourType);
    });

    // 音声ファイルアップロード
    this.inputSoundSec.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        this.soundEngine.setCustomAudio('sec', file);
        this.txtSoundSecName.textContent = file.name;
        this.showToast(`秒の音声を設定しました: ${file.name}`);
        setTimeout(() => this.soundEngine.playSecSound('custom'), 200);
      }
    });

    this.inputSoundMin.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        this.soundEngine.setCustomAudio('min', file);
        this.txtSoundMinName.textContent = file.name;
        this.showToast(`分の音声を設定しました: ${file.name}`);
        setTimeout(() => this.soundEngine.playMinSound('custom'), 200);
      }
    });

    this.inputSoundHour.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        this.soundEngine.setCustomAudio('hour', file);
        this.txtSoundHourName.textContent = file.name;
        this.showToast(`時の音声を設定しました: ${file.name}`);
        setTimeout(() => this.soundEngine.playHourSound('custom'), 200);
      }
    });

    this.rngVolume.addEventListener('input', (e) => {
      const val = e.target.value;
      this.txtVolumeValue.textContent = `${val}%`;
      this.soundEngine.setVolume(val / 100);
      this.saveToStorage();
    });

    // スライダーやスイッチの変更時に自動保存
    const autoSaveElements = [
      this.rngScale, this.rngDigitGap, this.rngColonMargin,
      this.chkBlinkColon, this.chkFallback, this.chkGuidelines,
      this.pickerBgColor, this.pickerColonColor,
      this.rngBgDim, this.rngBgBlur,
      this.chkVideoSound, this.selectSoundSec, this.selectSoundMin, this.selectSoundHour
    ];
    autoSaveElements.forEach(el => {
      if (el) el.addEventListener('change', () => this.saveToStorage());
    });

    // 作品パッケージ保存 (ZIPエクスポート)
    if (this.btnExportPackage) {
      this.btnExportPackage.addEventListener('click', () => {
        this.exportZipPackage();
      });
    }

    // 作品パッケージ読込 (ZIPインポート)
    if (this.inputImportPackage) {
      this.inputImportPackage.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (file) {
          await this.importZipPackage(file);
          e.target.value = '';
        }
      });
    }

    // 共有リンクコピーボタン (オプショナル)
    if (this.btnCopyShareUrl) {
      this.btnCopyShareUrl.addEventListener('click', async () => {
        const shareUrl = this.getShareUrl();
        try {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(shareUrl);
            this.showToast('設計パラメータの共有リンクを複製しました！');
          } else {
            prompt('以下のURLをコピーして共有してください:', shareUrl);
          }
        } catch (_) {
          prompt('以下のURLをコピーして共有してください:', shareUrl);
        }
      });
    }

    // 設定ファイル保存 (JSONエクスポート - オプショナル)
    if (this.btnExportConfig) {
      this.btnExportConfig.addEventListener('click', () => {
        this.exportConfig();
      });
    }

    // 設定ファイル読込 (JSONインポート - オプショナル)
    if (this.inputImportConfig) {
      this.inputImportConfig.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
          this.importConfig(file);
        }
      });
    }

    // 設定リセット
    this.btnResetConfig.addEventListener('click', () => {
      if (confirm('すべてのカスタマイズ設定を初期状態に戻しますか？')) {
        this.resetConfig();
      }
    });
  }

  /**
   * 現在のUI設定をプレーンオブジェクトとして取得
   */
  getConfig() {
    return {
      scale: parseFloat(this.rngScale.value),
      digitGap: parseInt(this.rngDigitGap.value, 10),
      colonMargin: parseInt(this.rngColonMargin.value, 10),
      blinkColon: this.chkBlinkColon.checked,
      fallback: this.chkFallback.checked,
      guidelines: this.chkGuidelines.checked,
      bgColor: this.pickerBgColor.value,
      colonColor: this.pickerColonColor.value,
      bgDim: parseInt(this.rngBgDim.value, 10),
      bgBlur: parseInt(this.rngBgBlur.value, 10),
      videoSound: this.chkVideoSound.checked,
      soundSecType: this.soundSecType,
      soundMinType: this.soundMinType,
      soundHourType: this.soundHourType,
      volume: parseInt(this.rngVolume.value, 10),
      assetMode: this.assetManager.getMode()
    };
  }

  /**
   * 設定オブジェクトをUIおよびCSSに反映
   */
  applyConfig(cfg, save = true) {
    if (!cfg) return;

    if (cfg.scale !== undefined) {
      this.rngScale.value = cfg.scale;
      this.txtScaleValue.textContent = `${Math.round(cfg.scale * 100)}%`;
      document.documentElement.style.setProperty('--clock-scale', cfg.scale);
    }
    if (cfg.digitGap !== undefined) {
      this.rngDigitGap.value = cfg.digitGap;
      this.txtDigitGapValue.textContent = `${cfg.digitGap}px`;
      document.documentElement.style.setProperty('--digit-gap', `${cfg.digitGap}px`);
    }
    if (cfg.colonMargin !== undefined) {
      this.rngColonMargin.value = cfg.colonMargin;
      this.txtColonMarginValue.textContent = `${cfg.colonMargin}px`;
      document.documentElement.style.setProperty('--colon-margin', `${cfg.colonMargin}px`);
    }
    if (cfg.blinkColon !== undefined) {
      this.chkBlinkColon.checked = cfg.blinkColon;
      this.colons.forEach(c => c.classList.toggle('blinking', cfg.blinkColon));
    }
    if (cfg.fallback !== undefined) {
      this.chkFallback.checked = cfg.fallback;
      this.digitRenderers.forEach(r => r.enableFallbackDummy = cfg.fallback);
    }
    if (cfg.guidelines !== undefined) {
      this.chkGuidelines.checked = cfg.guidelines;
      this.clockContainer.classList.toggle('show-guidelines', cfg.guidelines);
    }
    if (cfg.bgColor) {
      this.pickerBgColor.value = cfg.bgColor;
      document.documentElement.style.setProperty('--bg-color', cfg.bgColor);
    }
    if (cfg.colonColor) {
      this.pickerColonColor.value = cfg.colonColor;
      document.documentElement.style.setProperty('--colon-color', cfg.colonColor);
      document.documentElement.style.setProperty('--colon-glow', cfg.colonColor + '66');
    }
    if (cfg.bgDim !== undefined) {
      this.rngBgDim.value = cfg.bgDim;
      this.txtBgDimValue.textContent = `${cfg.bgDim}%`;
      document.documentElement.style.setProperty('--bg-dim', cfg.bgDim / 100);
    }
    if (cfg.bgBlur !== undefined) {
      this.rngBgBlur.value = cfg.bgBlur;
      this.txtBgBlurValue.textContent = `${cfg.bgBlur}px`;
      document.documentElement.style.setProperty('--bg-blur', `${cfg.bgBlur}px`);
    }
    if (cfg.videoSound !== undefined) {
      this.chkVideoSound.checked = cfg.videoSound;
      this.digitRenderers.forEach(r => r.playVideoAudio = cfg.videoSound);
    }
    if (cfg.soundSecType) {
      this.soundSecType = cfg.soundSecType;
      this.selectSoundSec.value = cfg.soundSecType;
      this.uploadSec.style.display = this.soundSecType === 'custom' ? 'flex' : 'none';
    }
    if (cfg.soundMinType) {
      this.soundMinType = cfg.soundMinType;
      this.selectSoundMin.value = cfg.soundMinType;
      this.uploadMin.style.display = this.soundMinType === 'custom' ? 'flex' : 'none';
    }
    if (cfg.soundHourType) {
      this.soundHourType = cfg.soundHourType;
      this.selectSoundHour.value = cfg.soundHourType;
      this.uploadHour.style.display = this.soundHourType === 'custom' ? 'flex' : 'none';
    }
    if (cfg.volume !== undefined) {
      this.rngVolume.value = cfg.volume;
      this.txtVolumeValue.textContent = `${cfg.volume}%`;
      this.soundEngine.setVolume(cfg.volume / 100);
    }
    if (cfg.assetMode && (cfg.assetMode === 'webm' || cfg.assetMode === 'png')) {
      if (this.assetManager.getMode() !== cfg.assetMode) {
        if (cfg.assetMode === 'webm') this.radioWebm.checked = true;
        else this.radioPng.checked = true;
        this.assetManager.setMode(cfg.assetMode);
        this.updateModeHelpText(cfg.assetMode);
      }
    }

    if (save) this.saveToStorage();
  }

  /**
   * localStorageへの自動保存
   */
  saveToStorage() {
    try {
      localStorage.setItem('digiclock_settings', JSON.stringify(this.getConfig()));
    } catch (_) {}
  }

  /**
   * システム標準の初期設定オブジェクト
   */
  getDefaultConfig() {
    return {
      scale: 1.6,
      digitGap: -100,
      colonMargin: -2,
      blinkColon: true,
      fallback: true,
      guidelines: false,
      bgColor: '#0d0f12',
      colonColor: '#4a5568',
      bgDim: 30,
      bgBlur: 0,
      videoSound: false,
      soundSecType: 'analog',
      soundMinType: 'none',
      soundHourType: 'none',
      volume: 70,
      assetMode: 'webm'
    };
  }

  /**
   * 起動時の設定読み込み（URLハッシュ優先、次いでlocalStorage）
   */
  loadSavedConfig() {
    // 1. URLハッシュ (#cfg=...) の確認
    try {
      const hash = window.location.hash;
      if (hash && hash.includes('cfg=')) {
        const match = hash.match(/cfg=([^&]+)/);
        if (match && match[1]) {
          const jsonStr = decodeURIComponent(escape(atob(decodeURIComponent(match[1]))));
          const parsed = JSON.parse(jsonStr);
          this.applyConfig(parsed, true);
          this.showToast('共有リンクから設定を復元しました');
          return;
        }
      }
    } catch (e) {
      console.warn('URL config parse error:', e);
    }

    // 2. localStorage からの復元（未保存時はデフォルト値を適用）
    try {
      const saved = localStorage.getItem('digiclock_settings');
      if (saved) {
        const parsed = JSON.parse(saved);
        this.applyConfig(parsed, false);
      } else {
        this.applyConfig(this.getDefaultConfig(), false);
      }
    } catch (e) {
      console.warn('LocalStorage config parse error:', e);
      this.applyConfig(this.getDefaultConfig(), false);
    }
  }

  /**
   * 現在の設定を含んだ共有URLを生成
   */
  getShareUrl() {
    const cfg = this.getConfig();
    const encoded = encodeURIComponent(btoa(unescape(encodeURIComponent(JSON.stringify(cfg)))));
    const baseUrl = `${window.location.protocol}//${window.location.host}${window.location.pathname}`;
    return `${baseUrl}#cfg=${encoded}`;
  }

  /**
   * 設定をJSONファイルとしてダウンロード保存
   */
  exportConfig() {
    const cfg = this.getConfig();
    const blob = new Blob([JSON.stringify(cfg, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `digiclock_config_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    this.showToast('設計図JSONをダウンロード保存しました');
  }

  /**
   * JSONファイルを読み込んで設定を復元
   */
  importConfig(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target.result);
        this.applyConfig(parsed, true);
        this.showToast('設計図JSONを適用しました');
      } catch (err) {
        alert('設計図ファイルの読み込みに失敗しました。正しいJSON形式か確認してください。');
      }
    };
    reader.readAsText(file);
  }

  /**
   * フォルダ選択やドロップから受け取ったファイル一覧を一括解析・反映
   */
  async processImportedFileList(files, sourceLabel = 'フォルダ') {
    const mediaFiles = [];
    let detectedConfig = null;
    let soundCount = 0;
    let bgLoaded = false;

    for (const file of files) {
      const relPath = file.fullPathEntry || file.webkitRelativePath || file.name;
      const lowerPath = relPath.toLowerCase();
      const baseName = file.name;

      // 1. 設定JSON
      if (lowerPath.endsWith('.json') && !detectedConfig) {
        try {
          const text = await file.text();
          detectedConfig = JSON.parse(text);
        } catch (_) {}
        continue;
      }

      // 2. 背景メディア
      if (lowerPath.includes('/bg/') || lowerPath.includes('assets/bg/') || baseName.startsWith('bg_') || baseName.startsWith('background')) {
        this.customBgFile = file;
        const fileUrl = URL.createObjectURL(file);
        this.txtBgFilename.textContent = file.name;
        this.btnClearBg.style.display = 'inline-block';
        if (file.type.startsWith('video/') || baseName.endsWith('.mp4') || baseName.endsWith('.webm')) {
          this.bgImage.classList.remove('active');
          this.bgImage.src = '';
          this.bgVideo.src = fileUrl;
          this.bgVideo.classList.add('active');
          this.bgVideo.play().catch(() => {});
        } else {
          this.bgVideo.classList.remove('active');
          this.bgVideo.pause();
          this.bgVideo.src = '';
          this.bgImage.src = fileUrl;
          this.bgImage.classList.add('active');
        }
        bgLoaded = true;
        continue;
      }

      // 3. カスタム音声
      if (lowerPath.includes('/sounds/') || baseName.startsWith('sec_') || baseName.startsWith('min_') || baseName.startsWith('hour_')) {
        if (baseName.startsWith('sec_') || lowerPath.includes('/sounds/sec_')) {
          this.soundEngine.setCustomAudio('sec', file);
          this.txtSoundSecName.textContent = file.name;
          this.soundSecType = 'custom';
          this.selectSoundSec.value = 'custom';
          this.uploadSec.style.display = 'flex';
          soundCount++;
          continue;
        } else if (baseName.startsWith('min_') || lowerPath.includes('/sounds/min_')) {
          this.soundEngine.setCustomAudio('min', file);
          this.txtSoundMinName.textContent = file.name;
          this.soundMinType = 'custom';
          this.selectSoundMin.value = 'custom';
          this.uploadMin.style.display = 'flex';
          soundCount++;
          continue;
        } else if (baseName.startsWith('hour_') || lowerPath.includes('/sounds/hour_')) {
          this.soundEngine.setCustomAudio('hour', file);
          this.txtSoundHourName.textContent = file.name;
          this.soundHourType = 'custom';
          this.selectSoundHour.value = 'custom';
          this.uploadHour.style.display = 'flex';
          soundCount++;
          continue;
        }
      }

      // 4. アニメーション素材（動画・画像）
      mediaFiles.push(file);
    }

    let animInfo = '';
    if (mediaFiles.length > 0) {
      const result = await this.assetManager.loadFromFolderFiles(mediaFiles);
      if (result.detectedMode === 'webm') this.radioWebm.checked = true;
      else this.radioPng.checked = true;
      this.updateModeHelpText(result.detectedMode);
      animInfo = `${result.total} 個の素材（${result.detectedMode.toUpperCase()}）`;
    }

    if (detectedConfig) {
      this.applyConfig(detectedConfig, true);
    }

    this.startPreload();

    const parts = [];
    if (animInfo) parts.push(animInfo);
    if (detectedConfig) parts.push('設定JSON');
    if (soundCount > 0) parts.push(`音声${soundCount}件`);
    if (bgLoaded) parts.push('背景');

    const desc = parts.length > 0 ? parts.join(', ') : 'ファイルが検出されませんでした';
    this.showToast(`${sourceLabel}から読み込みました: ${desc}`);
  }

  /**
   * 作品パッケージ（ZIP）のエクスポート
   * 設定JSON + 読み込まれているアニメーション素材（WebM / PNG） + 音声 + 背景 を1つのZIPにまとめる
   */
  async exportZipPackage() {
    if (typeof JSZip === 'undefined') {
      alert('ZIPライブラリ (JSZip) が読み込まれていません。ページを再読み込みしてください。');
      return;
    }

    try {
      this.showToast('製品パッケージを出荷準備中...');
      const zip = new JSZip();

      // 1. 設定JSON
      const cfg = this.getConfig();
      zip.file('digiclock_config.json', JSON.stringify(cfg, null, 2));

      // 2. WebM素材
      let assetCount = 0;
      const webmFiles = this.assetManager.rawFiles.webm;
      for (const [pattern, file] of Object.entries(webmFiles)) {
        if (file) {
          zip.file(`assets/webm/${file.name}`, file);
          assetCount++;
        }
      }

      // 3. PNG素材
      const pngFiles = this.assetManager.rawFiles.png;
      for (const [pattern, list] of Object.entries(pngFiles)) {
        if (Array.isArray(list)) {
          for (const file of list) {
            zip.file(`assets/png/${pattern}/${file.name}`, file);
            assetCount++;
          }
        }
      }

      // 4. カスタム音声
      if (this.soundEngine && this.soundEngine.customFiles) {
        if (this.soundEngine.customFiles.sec) {
          zip.file(`assets/sounds/sec_${this.soundEngine.customFiles.sec.name}`, this.soundEngine.customFiles.sec);
        }
        if (this.soundEngine.customFiles.min) {
          zip.file(`assets/sounds/min_${this.soundEngine.customFiles.min.name}`, this.soundEngine.customFiles.min);
        }
        if (this.soundEngine.customFiles.hour) {
          zip.file(`assets/sounds/hour_${this.soundEngine.customFiles.hour.name}`, this.soundEngine.customFiles.hour);
        }
      }

      // 5. 背景ファイル
      if (this.customBgFile) {
        zip.file(`assets/bg/${this.customBgFile.name}`, this.customBgFile);
      }

      if (assetCount === 0) {
        const proceed = confirm('ローカルから読み込まれたアニメーション部品（動画/連番画像）がありません。\n設計図JSONのみを製品ZIPとして出荷しますか？');
        if (!proceed) return;
      }

      // ZIPバイナリの生成とダウンロード
      const blob = await zip.generateAsync({
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 }
      });

      const now = new Date();
      const pad = (n) => String(n).padStart(2, '0');
      const timeStamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}`;
      const downloadName = `digiclock_work_${timeStamp}.zip`;

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = downloadName;
      a.click();
      URL.revokeObjectURL(url);

      this.showToast(`製品「${downloadName}」を出荷しました！`);
    } catch (err) {
      console.error('ZIP export error:', err);
      alert('製品パッケージの出荷に失敗しました: ' + err.message);
    }
  }

  /**
   * 作品パッケージ（ZIP）のインポート
   * ZIPを展開し、アニメーション素材・設定JSON・音声・背景を全自動でセットアップ
   */
  async importZipPackage(zipFile) {
    if (typeof JSZip === 'undefined') {
      alert('ZIPライブラリ (JSZip) が読み込まれていません。ページを再読み込みしてください。');
      return;
    }

    try {
      this.showToast('製品パッケージを展開中...');
      const zip = await JSZip.loadAsync(zipFile);

      let detectedConfig = null;
      const mediaFiles = [];
      let soundCount = 0;
      let bgLoaded = false;

      // エントリの走査
      const fileEntries = [];
      zip.forEach((relativePath, zipEntry) => {
        if (!zipEntry.dir && !relativePath.startsWith('__MACOSX/') && !zipEntry.name.startsWith('._')) {
          fileEntries.push(zipEntry);
        }
      });

      for (const entry of fileEntries) {
        const relPath = entry.name;
        const lowerPath = relPath.toLowerCase();
        const baseName = relPath.split('/').pop();

        // 1. 設定JSON
        if (lowerPath.endsWith('.json')) {
          try {
            const jsonText = await entry.async('string');
            detectedConfig = JSON.parse(jsonText);
          } catch (e) {
            console.warn('Config JSON parse error in zip:', e);
          }
          continue;
        }

        // 2. MIMEタイプの推定
        let mime = 'application/octet-stream';
        if (lowerPath.endsWith('.webm')) mime = 'video/webm';
        else if (lowerPath.endsWith('.mp4')) mime = 'video/mp4';
        else if (lowerPath.endsWith('.png')) mime = 'image/png';
        else if (lowerPath.endsWith('.jpg') || lowerPath.endsWith('.jpeg')) mime = 'image/jpeg';
        else if (lowerPath.endsWith('.webp')) mime = 'image/webp';
        else if (lowerPath.endsWith('.mp3')) mime = 'audio/mp3';
        else if (lowerPath.endsWith('.wav')) mime = 'audio/wav';
        else if (lowerPath.endsWith('.m4a') || lowerPath.endsWith('.aac')) mime = 'audio/mp4';

        const blob = await entry.async('blob');
        const file = new File([blob], baseName, { type: mime });
        file.fullPathEntry = relPath;

        // 3. 背景メディア
        if (lowerPath.includes('/bg/') || lowerPath.includes('assets/bg/') || baseName.startsWith('bg_') || baseName.startsWith('background')) {
          this.customBgFile = file;
          const fileUrl = URL.createObjectURL(file);
          this.txtBgFilename.textContent = file.name;
          this.btnClearBg.style.display = 'inline-block';
          if (file.type.startsWith('video/') || baseName.endsWith('.mp4') || baseName.endsWith('.webm')) {
            this.bgImage.classList.remove('active');
            this.bgImage.src = '';
            this.bgVideo.src = fileUrl;
            this.bgVideo.classList.add('active');
            this.bgVideo.play().catch(() => {});
          } else {
            this.bgVideo.classList.remove('active');
            this.bgVideo.pause();
            this.bgVideo.src = '';
            this.bgImage.src = fileUrl;
            this.bgImage.classList.add('active');
          }
          bgLoaded = true;
          continue;
        }

        // 4. カスタム音声
        if (lowerPath.includes('/sounds/') || baseName.startsWith('sec_') || baseName.startsWith('min_') || baseName.startsWith('hour_')) {
          if (baseName.startsWith('sec_') || lowerPath.includes('/sounds/sec_')) {
            this.soundEngine.setCustomAudio('sec', file);
            this.txtSoundSecName.textContent = file.name;
            this.soundSecType = 'custom';
            this.selectSoundSec.value = 'custom';
            this.uploadSec.style.display = 'flex';
            soundCount++;
            continue;
          } else if (baseName.startsWith('min_') || lowerPath.includes('/sounds/min_')) {
            this.soundEngine.setCustomAudio('min', file);
            this.txtSoundMinName.textContent = file.name;
            this.soundMinType = 'custom';
            this.selectSoundMin.value = 'custom';
            this.uploadMin.style.display = 'flex';
            soundCount++;
            continue;
          } else if (baseName.startsWith('hour_') || lowerPath.includes('/sounds/hour_')) {
            this.soundEngine.setCustomAudio('hour', file);
            this.txtSoundHourName.textContent = file.name;
            this.soundHourType = 'custom';
            this.selectSoundHour.value = 'custom';
            this.uploadHour.style.display = 'flex';
            soundCount++;
            continue;
          }
        }

        // 5. アニメーション素材（WebM / PNG等）
        if (mime.startsWith('video/') || mime.startsWith('image/')) {
          mediaFiles.push(file);
        }
      }

      // 素材の登録
      let animInfo = '';
      if (mediaFiles.length > 0) {
        const result = await this.assetManager.loadFromFolderFiles(mediaFiles);
        if (result.detectedMode === 'webm') this.radioWebm.checked = true;
        else this.radioPng.checked = true;
        this.updateModeHelpText(result.detectedMode);
        animInfo = `${result.total} 個の部品（${result.detectedMode.toUpperCase()}）`;
      }

      // 設定の復元
      if (detectedConfig) {
        this.applyConfig(detectedConfig, true);
      }

      this.startPreload();

      const summaryParts = [];
      if (animInfo) summaryParts.push(animInfo);
      if (detectedConfig) summaryParts.push('設計図');
      if (soundCount > 0) summaryParts.push(`音声${soundCount}件`);
      if (bgLoaded) summaryParts.push('外装');

      const summaryText = summaryParts.length > 0 ? ` (${summaryParts.join(', ')})` : '';
      this.showToast(`製品「${zipFile.name}」を正常にロードしました！${summaryText}`);
    } catch (err) {
      console.error('ZIP import error:', err);
      alert('製品パッケージの読み込みに失敗しました: ' + err.message);
    }
  }

  /**
   * 設定を初期状態にリセット
   */
  resetConfig() {
    try {
      localStorage.removeItem('digiclock_settings');
      if (window.location.hash) {
        history.replaceState(null, null, ' ');
      }
    } catch (_) {}

    const defaultConfig = this.getDefaultConfig();
    this.applyConfig(defaultConfig, true);
    this.startPreload();
    this.showToast('設計を初期状態にリセットしました');
  }

  /**
   * DataTransferItemListからフォルダ再帰走査してファイル一覧を取得
   */
  async scanFilesFromDataTransfer(items) {
    const files = [];

    const readAllEntries = async (dirReader) => {
      const allEntries = [];
      let batch;
      do {
        batch = await new Promise((resolve) => dirReader.readEntries(resolve, () => resolve([])));
        if (batch && batch.length > 0) allEntries.push(...batch);
      } while (batch && batch.length > 0);
      return allEntries;
    };

    const traverse = async (entry) => {
      if (!entry) return;
      if (entry.isFile) {
        const file = await new Promise((resolve) => entry.file(resolve, () => resolve(null)));
        if (file) {
          file.fullPathEntry = entry.fullPath;
          files.push(file);
        }
      } else if (entry.isDirectory) {
        const reader = entry.createReader();
        const entries = await readAllEntries(reader);
        for (const child of entries) {
          await traverse(child);
        }
      }
    };

    const queue = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.webkitGetAsEntry) {
        const entry = item.webkitGetAsEntry();
        if (entry) queue.push(traverse(entry));
      } else if (item.kind === 'file') {
        const f = item.getAsFile();
        if (f) files.push(f);
      }
    }
    await Promise.all(queue);
    return files;
  }

  /**
   * 対象フォルダを開く（またはパスをクリップボードにコピー）
   */
  async handleOpenFolder() {
    const mode = this.assetManager.getMode();
    const folderRelPath = mode === 'webm' ? 'assets/webm' : 'assets/png';

    // 1. ローカルサーバーのFinderオープンAPIを試行
    try {
      const resp = await fetch(`/__open_folder?path=${encodeURIComponent(folderRelPath)}`, {
        method: 'POST'
      });
      if (resp.ok) {
        this.showToast(`Finderでフォルダを開きました: ${folderRelPath}`);
        return;
      }
    } catch (_) {
      // 通常の静的サーバー等の場合はスキップ
    }

    // 2. クリップボードへのパスコピー
    const fullPathHint = `${folderRelPath}/`;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(fullPathHint);
        this.showToast(`フォルダパス「${fullPathHint}」をコピーしました！（Finderの ⌘+Shift+G で移動できます）`);
      } else {
        prompt('対象フォルダのパスです。コピーしてFinderで開いてください:', fullPathHint);
      }
    } catch (_) {
      prompt('対象フォルダのパスです。コピーしてFinderで開いてください:', fullPathHint);
    }
  }

  updateModeHelpText(mode) {
    if (mode === 'webm') {
      this.modeHelpText.innerHTML = `<code>${ASSET_CONFIG.webm.basePath}*.webm</code> を読み込みます。`;
    } else {
      this.modeHelpText.innerHTML = `<code>${ASSET_CONFIG.png.basePath}{from}_to_{to}/${ASSET_CONFIG.png.prefix}*.png</code> を読み込みます。`;
    }
  }

  setOpMode(mode) {
    this.opMode = mode;
    if (this.btnModeClock) {
      this.btnModeClock.classList.toggle('active', mode === 'clock');
    }

    if (this.testInterval) {
      clearInterval(this.testInterval);
      this.testInterval = null;
    }

    if (mode === 'clock') {
      this.showToast('時計モード: 現在時刻に同期しました');
      const now = new Date();
      const currentDigits = this.getDigitsFromDate(now);
      this.digitRenderers.forEach((r, i) => {
        r.drawStatic(currentDigits[i]);
      });
      this.lastDigits = [...currentDigits];
      this.lastSec = now.getSeconds();
    }
  }

  /**
   * 12種類の個別パターンテスト再生（ボタンタップ時）
   * @param {number} from 遷移元数字
   * @param {number} to 遷移先数字
   */
  playSinglePatternTest(from, to) {
    if (this.testInterval) {
      clearInterval(this.testInterval);
      this.testInterval = null;
    }
    // どの桁で再生するか判定:
    // 2→0: 時の10の位 (桁0) または 1の位
    // 5→0: 分/秒の10の位 (桁4)
    // それ以外: 1の位 (桁5)
    let targetIdx = 5;
    if (from === 5 && to === 0) {
      targetIdx = 4;
    } else if (from === 2 && to === 0) {
      targetIdx = 0;
    }

    // アニメーション再生
    this.digitRenderers[targetIdx].startTransition(from, to);
    this.lastDigits[targetIdx] = to;

    // 音の再生（秒音）
    this.soundEngine.unlock();
    this.soundEngine.playSecSound(this.soundSecType);

    this.showToast(`パターン ${from}→${to} をテスト再生しました`);
  }

  async startPreload() {
    const mode = this.assetManager.getMode();
    this.preloadProgressBar.style.width = '0%';
    this.preloadStatusText.textContent = `プリロード中... (0%)`;
    this.assetPatternList.innerHTML = '';

    const statusMap = await this.assetManager.preloadAll((loaded, total, pattern, success) => {
      const pct = Math.round((loaded / total) * 100);
      this.preloadProgressBar.style.width = `${pct}%`;
      this.preloadStatusText.textContent = `プリロード中: ${loaded}/${total} (${pct}%)`;
    });

    const patterns = mode === 'webm' ? ASSET_CONFIG.webm.patterns : ASSET_CONFIG.png.patterns;
    let successCount = 0;

    patterns.forEach(pat => {
      const isLoaded = statusMap[pat] === 'loaded';
      if (isLoaded) successCount++;
      const li = document.createElement('li');
      li.className = isLoaded ? 'loaded' : 'missing';
      li.innerHTML = `
        <span>${pat}</span>
        <span>${isLoaded ? '✓ 読込完了' : '× 未配置 (モック)'}</span>
      `;
      this.assetPatternList.appendChild(li);
    });

    if (successCount === patterns.length) {
      this.preloadStatusText.textContent = `全素材の準備完了 (${successCount}/${patterns.length})`;
      this.preloadStatusText.style.color = '#34d399';
    } else if (successCount > 0) {
      this.preloadStatusText.textContent = `一部素材を検出 (${successCount}/${patterns.length} 件)`;
      this.preloadStatusText.style.color = '#fbbf24';
    } else {
      this.preloadStatusText.textContent = `素材未配置（ダミーアニメーションで動作中）`;
      this.preloadStatusText.style.color = '#f87171';
    }

    if (this.opMode === 'clock') {
      const now = new Date();
      const currentDigits = this.getDigitsFromDate(now);
      this.digitRenderers.forEach((r, i) => {
        r.drawStatic(currentDigits[i]);
      });
      this.lastDigits = [...currentDigits];
    }
  }

  getDigitsFromDate(date) {
    const h = date.getHours();
    const m = date.getMinutes();
    const s = date.getSeconds();

    const pad = (n) => String(n).padStart(2, '0');
    const str = pad(h) + pad(m) + pad(s);
    return str.split('').map(Number);
  }

  startMainLoop() {
    const loop = (nowTime) => {
      this.digitRenderers.forEach(r => r.update(nowTime));

      if (this.opMode === 'clock') {
        const now = new Date();
        const currentSec = now.getSeconds();

        if (currentSec !== this.lastSec) {
          this.lastSec = currentSec;
          const currentMin = now.getMinutes();
          const newDigits = this.getDigitsFromDate(now);

          if (this.lastDigits[0] !== -1) {
            let hasChanged = false;
            for (let i = 0; i < 6; i++) {
              if (this.lastDigits[i] !== newDigits[i]) {
                this.digitRenderers[i].startTransition(this.lastDigits[i], newDigits[i]);
                hasChanged = true;
              }
            }

            if (hasChanged) {
              // 音声再生（時・分・秒の優先制御）
              if (currentMin === 0 && currentSec === 0 && this.soundHourType !== 'none') {
                this.soundEngine.playHourSound(this.soundHourType);
              } else if (currentSec === 0 && this.soundMinType !== 'none') {
                this.soundEngine.playMinSound(this.soundMinType);
              } else {
                this.soundEngine.playSecSound(this.soundSecType);
              }
            }
          } else {
            this.digitRenderers.forEach((r, i) => r.drawStatic(newDigits[i]));
          }

          this.lastDigits = [...newDigits];
        }
      }

      requestAnimationFrame(loop);
    };

    requestAnimationFrame(loop);
  }

  showToast(message) {
    if (!this.toast) return;
    this.toast.textContent = message;
    this.toast.classList.add('show');
    clearTimeout(this.toastTimeout);
    this.toastTimeout = setTimeout(() => {
      this.toast.classList.remove('show');
    }, 2800);
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window.app = new ClockApp();
});
