const THREE = window.THREE;

import { WorldManager } from './world.js';
import { CraneManager } from './crane.js';
import { PrizeManager } from './prizes.js';

class GameApp {
  constructor() {
    this.wm = new WorldManager('canvas-container');
    this.crane = new CraneManager(this.wm);
    this.prizeMgr = new PrizeManager(this.wm);
    
    // ゲームステート
    // States: 'WAIT_COIN', 'READY', 'MOVE_X', 'READY_FORWARD', 'MOVE_Z', 'DESCENDING', 'GRABBING', 'ASCENDING', 'RETURNING', 'RELEASING', 'RESETTING', 'GAME_OVER'
    this.state = 'WAIT_COIN';
    
    // 5コインチャレンジ用データ
    this.initialCoins = 5;
    this.coins = this.initialCoins;
    this.score = 0;
    this.gainedCount = 0;
    this.timer = 0;
    this.maxPlayTime = 15;
    this.timerInterval = null;
    
    // キー入力・ボタン押下状態
    this.isButton1Pressed = false; // 右移動用
    this.isButton2Pressed = false; // 奥移動用
    
    // アーム下降時の最低高さ
    this.grabHeight = 1.15;
    
    this.clock = new THREE.Clock();
    
    this.initDOM();
    this.initEvents();
    
    // 初回のぬいぐるみ生成
    this.prizeMgr.spawnPrizes();
    this.updateUI();
    
    // ゲームループ開始
    this.animate();
  }

  initDOM() {
    this.dom = {
      score: document.getElementById('score-value'),
      coins: document.getElementById('coin-value'),
      status: document.getElementById('status-text'),
      timer: document.getElementById('timer-text'),
      message: document.getElementById('game-message'),
      btnCoin: document.getElementById('insert-coin-btn'),
      btnCoinLabel: document.getElementById('coin-btn-label'),
      btnRight: document.getElementById('btn-right'),
      btnForward: document.getElementById('btn-forward'),
      prizeList: document.getElementById('prize-list'),
      prizeCountLabel: document.getElementById('prize-count-label')
    };
  }

  initEvents() {
    // 1. PLAY（コインを1枚使って開始 / 終了後はリトライ）ボタン
    this.dom.btnCoin.addEventListener('click', () => this.onCoinButtonClick());
    
    // 2. 「ボタン1 (右)」の操作イベント（マウス・タッチ）
    const startRightMove = (e) => {
      e.preventDefault();
      if (this.state === 'READY') {
        this.state = 'MOVE_X';
        this.isButton1Pressed = true;
        this.updateUI();
      }
    };
    
    const stopRightMove = (e) => {
      e.preventDefault();
      if (this.state === 'MOVE_X') {
        this.isButton1Pressed = false;
        this.state = 'READY_FORWARD';
        this.setMessage('HOLD "FORWARD" TO MOVE CLAW');
        this.updateUI();
      }
    };

    this.dom.btnRight.addEventListener('mousedown', startRightMove);
    this.dom.btnRight.addEventListener('touchstart', startRightMove);
    this.dom.btnRight.addEventListener('mouseup', stopRightMove);
    this.dom.btnRight.addEventListener('touchend', stopRightMove);
    this.dom.btnRight.addEventListener('mouseleave', stopRightMove);

    // 3. 「ボタン2 (奥)」の操作イベント（マウス・タッチ）
    const startForwardMove = (e) => {
      e.preventDefault();
      if (this.state === 'READY_FORWARD') {
        this.state = 'MOVE_Z';
        this.isButton2Pressed = true;
        this.updateUI();
      }
    };
    
    const stopForwardMove = (e) => {
      e.preventDefault();
      if (this.state === 'MOVE_Z') {
        this.isButton2Pressed = false;
        this.startAutoSequence();
      }
    };

    this.dom.btnForward.addEventListener('mousedown', startForwardMove);
    this.dom.btnForward.addEventListener('touchstart', startForwardMove);
    this.dom.btnForward.addEventListener('mouseup', stopForwardMove);
    this.dom.btnForward.addEventListener('touchend', stopForwardMove);
    this.dom.btnForward.addEventListener('mouseleave', stopForwardMove);

    // 4. キーボード操作サポート (1: 右移動, 2: 奥移動, C/Space/Enter: コインを使ってスタート)
    window.addEventListener('keydown', (e) => {
      if (e.key === 'c' || e.key === 'C' || e.key === ' ') {
        if (this.state === 'WAIT_COIN' || this.state === 'GAME_OVER') {
          e.preventDefault();
          this.onCoinButtonClick();
        }
      }
      if (e.key === '1') {
        if (this.state === 'READY') {
          this.state = 'MOVE_X';
          this.isButton1Pressed = true;
          this.dom.btnRight.classList.add('active');
          this.updateUI();
        }
      }
      if (e.key === '2') {
        if (this.state === 'READY_FORWARD') {
          this.state = 'MOVE_Z';
          this.isButton2Pressed = true;
          this.dom.btnForward.classList.add('active');
          this.updateUI();
        }
      }
    });

    window.addEventListener('keyup', (e) => {
      if (e.key === '1') {
        if (this.state === 'MOVE_X') {
          this.isButton1Pressed = false;
          this.dom.btnRight.classList.remove('active');
          this.state = 'READY_FORWARD';
          this.setMessage('HOLD "FORWARD" TO MOVE CLAW');
          this.updateUI();
        }
      }
      if (e.key === '2') {
        if (this.state === 'MOVE_Z') {
          this.isButton2Pressed = false;
          this.dom.btnForward.classList.remove('active');
          this.startAutoSequence();
        }
      }
    });
  }

  // コインボタンが押された時の処理（1枚消費して1プレイ開始、または5回終了後のリセット）
  onCoinButtonClick() {
    if (this.state === 'GAME_OVER') {
      this.resetChallenge();
      return;
    }

    if (this.state === 'WAIT_COIN' && this.coins > 0) {
      this.startPlay();
    }
  }

  // 1コイン消費して1回分のプレイを開始
  startPlay() {
    if (this.coins <= 0) return;
    
    this.coins--;
    this.dom.coins.textContent = this.coins;
    
    this.dom.coins.style.animation = 'none';
    setTimeout(() => {
      this.dom.coins.style.animation = 'popIn 0.3s ease-out';
    }, 10);
    
    const attemptNum = this.initialCoins - this.coins;
    this.state = 'READY';
    this.timer = this.maxPlayTime;
    this.crane.open();
    
    this.setMessage(`TRY ${attemptNum} / ${this.initialCoins} : HOLD "RIGHT" TO MOVE`);
    this.updateUI();
    
    this.startTimer();
  }

  // 5回終了後の「NEW CHALLENGE」リセット処理
  resetChallenge() {
    this.coins = this.initialCoins;
    this.score = 0;
    this.gainedCount = 0;
    this.dom.coins.textContent = this.coins;
    this.dom.score.textContent = '0000';
    if (this.dom.prizeCountLabel) {
      this.dom.prizeCountLabel.textContent = '(0)';
    }
    this.dom.prizeList.innerHTML = '<div class="no-prizes">No prizes yet!</div>';

    this.prizeMgr.spawnPrizes();
    this.state = 'WAIT_COIN';
    this.setMessage(`USE 1 COIN TO START (${this.coins} LEFT)`);
    this.updateUI();
  }

  startTimer() {
    if (this.timerInterval) clearInterval(this.timerInterval);
    
    this.dom.timer.textContent = `${this.timer}s`;
    
    this.timerInterval = setInterval(() => {
      if (this.state === 'READY' || this.state === 'MOVE_X' || this.state === 'READY_FORWARD' || this.state === 'MOVE_Z') {
        this.timer--;
        this.dom.timer.textContent = `${this.timer}s`;
        
        if (this.timer <= 0) {
          clearInterval(this.timerInterval);
          this.isButton1Pressed = false;
          this.isButton2Pressed = false;
          this.startAutoSequence();
        }
      } else {
        clearInterval(this.timerInterval);
        this.dom.timer.textContent = '--';
      }
    }, 1000);
  }

  startAutoSequence() {
    clearInterval(this.timerInterval);
    this.dom.timer.textContent = '--';
    
    this.state = 'DESCENDING';
    this.setMessage('CLAW DESCENDING...');
    this.updateUI();
  }

  updateUI() {
    this.dom.status.className = '';
    
    switch (this.state) {
      case 'WAIT_COIN':
        this.dom.status.textContent = `READY (${this.coins} LEFT)`;
        this.dom.status.classList.add('status-ready');
        this.dom.btnRight.disabled = true;
        this.dom.btnForward.disabled = true;
        this.dom.btnCoin.disabled = false;
        if (this.dom.btnCoinLabel) {
          this.dom.btnCoinLabel.textContent = `PLAY (USE 1 COIN)`;
        }
        break;
      case 'GAME_OVER':
        this.dom.status.textContent = 'FINISHED';
        this.dom.status.classList.add('status-ready');
        this.dom.btnRight.disabled = true;
        this.dom.btnForward.disabled = true;
        this.dom.btnCoin.disabled = false;
        if (this.dom.btnCoinLabel) {
          this.dom.btnCoinLabel.textContent = 'RETRY (5 COINS)';
        }
        break;
      case 'READY':
        this.dom.status.textContent = 'PLAYING';
        this.dom.status.classList.add('status-moving');
        this.dom.btnRight.disabled = false;
        this.dom.btnForward.disabled = true;
        this.dom.btnCoin.disabled = true;
        break;
      case 'MOVE_X':
        this.dom.status.textContent = 'MOVING X';
        this.dom.status.classList.add('status-moving');
        this.dom.btnRight.disabled = false;
        this.dom.btnForward.disabled = true;
        break;
      case 'READY_FORWARD':
        this.dom.status.textContent = 'PLAYING';
        this.dom.status.classList.add('status-moving');
        this.dom.btnRight.disabled = true;
        this.dom.btnForward.disabled = false;
        break;
      case 'MOVE_Z':
        this.dom.status.textContent = 'MOVING Z';
        this.dom.status.classList.add('status-moving');
        this.dom.btnRight.disabled = true;
        this.dom.btnForward.disabled = false;
        break;
      default:
        this.dom.status.textContent = 'BUSY';
        this.dom.status.classList.add('status-busy');
        this.dom.btnRight.disabled = true;
        this.dom.btnForward.disabled = true;
        this.dom.btnCoin.disabled = true;
        break;
    }
  }

  setMessage(text, isAlert = false) {
    this.dom.message.textContent = text;
    if (isAlert) {
      this.dom.message.style.borderColor = '#00f0ff';
      this.dom.message.style.boxShadow = '0 0 20px rgba(0, 240, 255, 0.9)';
    } else {
      this.dom.message.style.borderColor = '#ff2d55';
      this.dom.message.style.boxShadow = '0 0 10px rgba(255, 45, 85, 0.6)';
    }
  }

  animate() {
    requestAnimationFrame(() => this.animate());
    
    const dt = Math.min(this.clock.getDelta(), 0.05);
    
    this.updateLogic(dt);
    this.wm.step(dt);
    this.wm.render();
  }

  updateLogic(dt) {
    this.crane.update(dt, this.state);
    this.prizeMgr.update(dt, this.crane);
    
    // 常時ぬいぐるみが落とし口に入ったかを検知
    const gained = this.prizeMgr.checkGainedPrizes();
    if (gained.length > 0) {
      gained.forEach(prize => this.onPrizeGained(prize));
    }

    switch (this.state) {
      case 'MOVE_X':
        if (this.isButton1Pressed) {
          this.crane.moveRight(dt);
          if (this.crane.x >= this.crane.maxX) {
            this.isButton1Pressed = false;
            this.state = 'READY_FORWARD';
            this.updateUI();
            this.setMessage('HOLD "FORWARD" TO MOVE CLAW');
          }
        }
        break;
        
      case 'MOVE_Z':
        if (this.isButton2Pressed) {
          this.crane.moveForward(dt);
          if (this.crane.z <= this.crane.minZ) {
            this.isButton2Pressed = false;
            this.startAutoSequence();
          }
        }
        break;
        
      case 'DESCENDING':
        const reachedBottom = this.crane.descend(dt, this.grabHeight, this.prizeMgr.prizes);
        if (reachedBottom) {
          this.state = 'GRABBING';
          this.setMessage('SQUEEZING PLUSHIE...');
          
          this.crane.attemptGrab();
          
          setTimeout(() => {
            this.state = 'ASCENDING';
            this.setMessage('LIFTING UP...');
          }, 1000);
        }
        break;
        
      case 'ASCENDING':
        const reachedTop = this.crane.ascend(dt);
        if (reachedTop) {
          this.state = 'RETURNING';
          this.setMessage('RETURNING TO HOME...');
        }
        break;
        
      case 'RETURNING':
        const reachedHome = this.crane.returnToHome(dt);
        if (reachedHome) {
          this.state = 'RELEASING';
          this.setMessage('RELEASING...');
          
          this.crane.releasePrize();
          
          // 落としたぬいぐるみが転がり落ちるまで少し待ってからターン終了判定へ
          setTimeout(() => {
            this.state = 'RESETTING';
          }, 1800);
        }
        break;
        
      case 'RESETTING':
        if (this.coins > 0) {
          // 1枚ずつ手動でプレイするため、自動で次のコインを消費せず WAIT_COIN で待機する
          this.state = 'WAIT_COIN';
          this.setMessage(`USE 1 COIN FOR NEXT TRY (${this.coins} LEFT)`);
          this.updateUI();
        } else {
          // 5回すべて終了！獲得個数とスコアの結果を表示
          this.state = 'GAME_OVER';
          this.setMessage(`FINISH! YOU GOT ${this.gainedCount} PLUSHIES! (${this.score}pts)`, true);
          this.updateUI();
        }
        break;
    }
  }

  onPrizeGained(prize) {
    this.score += prize.score;
    this.gainedCount++;
    this.dom.score.textContent = String(this.score).padStart(4, '0');
    if (this.dom.prizeCountLabel) {
      this.dom.prizeCountLabel.textContent = `(${this.gainedCount})`;
    }
    
    this.dom.score.style.animation = 'none';
    setTimeout(() => {
      this.dom.score.style.animation = 'popIn 0.3s ease-out';
    }, 10);

    if (this.state === 'GAME_OVER') {
      this.setMessage(`FINISH! YOU GOT ${this.gainedCount} PLUSHIES! (${this.score}pts)`, true);
    } else {
      this.setMessage(`GET ${prize.name}! (+${prize.score}pts)`, true);
    }
    
    const emptyMsg = this.dom.prizeList.querySelector('.no-prizes');
    if (emptyMsg) {
      emptyMsg.remove();
    }
    
    const prizeItem = document.createElement('div');
    prizeItem.className = 'prize-item';
    prizeItem.title = `${prize.name} (+${prize.score}pts)`;
    
    const figImg = document.createElement('img');
    figImg.className = 'prize-figure';
    figImg.src = this.prizeMgr.renderPlushThumbnail(prize.config);
    figImg.alt = prize.name;
    
    prizeItem.appendChild(figImg);
    
    this.dom.prizeList.insertBefore(prizeItem, this.dom.prizeList.firstChild);
  }
}

window.addEventListener('DOMContentLoaded', () => {
  new GameApp();
});
