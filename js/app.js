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
    // States: 'WAIT_COIN', 'READY', 'MOVE_X', 'READY_FORWARD', 'MOVE_Z', 'DESCENDING', 'GRABBING', 'ASCENDING', 'RETURNING', 'RELEASING', 'RESETTING'
    this.state = 'WAIT_COIN';
    
    // ゲームデータ
    this.score = 0;
    this.coins = 0;
    this.timer = 0;
    this.maxPlayTime = 15; // 持ち時間
    this.timerInterval = null;
    
    // キー入力・ボタン押下状態
    this.isButton1Pressed = false; // 右移動用
    this.isButton2Pressed = false; // 奥移動用
    
    // アーム下降時のターゲットの高さ
    this.grabHeight = 1.35;
    
    // タイマー管理用
    this.clock = new THREE.Clock();
    
    this.initDOM();
    this.initEvents();
    
    // 初回景品生成
    this.prizeMgr.spawnPrizes();
    
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
      btnRight: document.getElementById('btn-right'),
      btnForward: document.getElementById('btn-forward'),
      prizeList: document.getElementById('prize-list')
    };
  }

  initEvents() {
    // 1. コイン投入
    this.dom.btnCoin.addEventListener('click', () => this.insertCoin());
    
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

    // 4. キーボード操作サポート (1: 右移動, 2: 奥移動, C: コイン)
    window.addEventListener('keydown', (e) => {
      if (e.key === 'c' || e.key === 'C') {
        this.insertCoin();
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

  // コイン投入処理
  insertCoin() {
    this.coins++;
    this.dom.coins.textContent = this.coins;
    
    // ネオン発光エフェクトのようなフラッシュアニメーションをCSSに指示
    this.dom.coins.style.animation = 'none';
    setTimeout(() => {
      this.dom.coins.style.animation = 'popIn 0.3s ease-out';
    }, 10);
    
    if (this.state === 'WAIT_COIN') {
      this.startPlay();
    }
  }

  // ゲームプレイ開始
  startPlay() {
    if (this.coins <= 0) return;
    
    this.coins--;
    this.dom.coins.textContent = this.coins;
    
    this.state = 'READY';
    this.timer = this.maxPlayTime;
    
    // メッセージとUIの更新
    this.setMessage('HOLD "RIGHT" TO MOVE CLAW');
    this.updateUI();
    
    // タイマー開始
    this.startTimer();
  }

  // タイマー管理
  startTimer() {
    if (this.timerInterval) clearInterval(this.timerInterval);
    
    this.dom.timer.textContent = `${this.timer}s`;
    
    this.timerInterval = setInterval(() => {
      if (this.state === 'READY' || this.state === 'MOVE_X' || this.state === 'READY_FORWARD' || this.state === 'MOVE_Z') {
        this.timer--;
        this.dom.timer.textContent = `${this.timer}s`;
        
        if (this.timer <= 0) {
          // タイムアウト時は自動的にアームが下降
          clearInterval(this.timerInterval);
          this.isButton1Pressed = false;
          this.isButton2Pressed = false;
          this.startAutoSequence();
        }
      } else {
        // オートシークエンス中はタイマー停止
        clearInterval(this.timerInterval);
        this.dom.timer.textContent = '--';
      }
    }, 1000);
  }

  // 自動シーケンス（下降・掴む・上昇・戻る・離す）の開始
  startAutoSequence() {
    clearInterval(this.timerInterval);
    this.dom.timer.textContent = '--';
    
    this.state = 'DESCENDING';
    this.setMessage('CLAW DESCENDING...');
    this.updateUI();
  }

  // UIボタンとステータステキストの活性状態制御
  updateUI() {
    // ステータステキストのクラス＆文言変更
    this.dom.status.className = ''; // クラスリセット
    
    switch (this.state) {
      case 'WAIT_COIN':
        this.dom.status.textContent = 'READY';
        this.dom.status.classList.add('status-ready');
        this.dom.btnRight.disabled = true;
        this.dom.btnForward.disabled = true;
        this.dom.btnCoin.disabled = false;
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
      default: // オートシーケンス中 ('DESCENDING', 'GRABBING', 'ASCENDING' 等)
        this.dom.status.textContent = 'BUSY';
        this.dom.status.classList.add('status-busy');
        this.dom.btnRight.disabled = true;
        this.dom.btnForward.disabled = true;
        this.dom.btnCoin.disabled = true;
        break;
    }
  }

  // メッセージ表示の更新
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

  // アニメーション＆メインループ
  animate() {
    requestAnimationFrame(() => this.animate());
    
    // 前フレームからの経過時間（デルタタイム）を取得
    const dt = Math.min(this.clock.getDelta(), 0.1); // 極端なラグによるジャンプを防ぐため上限0.1秒
    
    // 物理世界とアームモデルの更新
    this.updateLogic(dt);
    
    // 物理世界のシミュレーションを進め、描画オブジェクトと同期
    this.wm.step(dt);
    
    // シーンのレンダリング
    this.wm.render();
  }

  // ゲームのステートマシンロジック
  updateLogic(dt) {
    this.crane.update(dt, this.state);
    
    // 常時景品が落とし口に入ったかを検知
    const gained = this.prizeMgr.checkGainedPrizes();
    if (gained.length > 0) {
      gained.forEach(prize => this.onPrizeGained(prize));
    }

    // ステートごとのクレーン制御
    switch (this.state) {
      case 'MOVE_X':
        if (this.isButton1Pressed) {
          this.crane.moveRight(dt);
          // 右端に到達した場合は強制的に次のステートへ
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
          // 奥端に到達した場合は自動で下降へ
          if (this.crane.z <= this.crane.minZ) {
            this.isButton2Pressed = false;
            this.startAutoSequence();
          }
        }
        break;
        
      case 'DESCENDING':
        // 下降処理
        const reachedBottom = this.crane.descend(dt, this.grabHeight);
        if (reachedBottom) {
          this.state = 'GRABBING';
          this.setMessage('GRABBING PRIZE...');
          
          // 0.8秒間かけて掴み処理を行う（アームを閉じてホールドする）
          this.crane.attemptGrab(this.prizeMgr.prizes);
          
          setTimeout(() => {
            this.state = 'ASCENDING';
            this.setMessage('LIFTING UP...');
          }, 800);
        }
        break;
        
      case 'ASCENDING':
        // 上昇処理
        const reachedTop = this.crane.ascend(dt);
        if (reachedTop) {
          this.state = 'RETURNING';
          this.setMessage('RETURNING TO HOME...');
        }
        break;
        
      case 'RETURNING':
        // 初期位置（落とし口）に戻る
        const reachedHome = this.crane.returnToHome(dt);
        if (reachedHome) {
          this.state = 'RELEASING';
          this.setMessage('RELEASING...');
          
          // 景品を離す
          this.crane.releasePrize();
          
          // 1.5秒待ってからリセット状態に移行（景品が落下しきるのを待つ）
          setTimeout(() => {
            this.state = 'RESETTING';
          }, 1500);
        }
        break;
        
      case 'RESETTING':
        // 景品が空になったかチェックし、少なすぎたら補充
        if (this.prizeMgr.prizes.length < 5) {
          this.prizeMgr.spawnPrizes();
        }
        
        // 連続プレイのためにクレジット（コイン）があるか確認
        if (this.coins > 0) {
          this.startPlay();
        } else {
          this.state = 'WAIT_COIN';
          this.setMessage('INSERT COIN TO PLAY AGAIN');
          this.updateUI();
        }
        break;
    }
  }

  // 景品獲得時のイベント処理
  onPrizeGained(prize) {
    this.score += prize.score;
    // スコアの4桁ゼロ埋め表示
    this.dom.score.textContent = String(this.score).padStart(4, '0');
    
    // スコア表示のアニメーション
    this.dom.score.style.animation = 'none';
    setTimeout(() => {
      this.dom.score.style.animation = 'popIn 0.3s ease-out';
    }, 10);

    // 獲得お祝いメッセージ
    this.setMessage(`GET ${prize.name}! (+${prize.score}pts)`, true);
    
    // 獲得リストのUIを更新
    const emptyMsg = this.dom.prizeList.querySelector('.no-prizes');
    if (emptyMsg) {
      emptyMsg.remove();
    }
    
    const prizeItem = document.createElement('div');
    prizeItem.className = 'prize-item';
    
    const badge = document.createElement('span');
    badge.className = 'prize-badge';
    badge.style.backgroundColor = `#${prize.color.toString(16).padStart(6, '0')}`;
    
    const label = document.createTextNode(prize.name);
    
    prizeItem.appendChild(badge);
    prizeItem.appendChild(label);
    
    // リストの先頭に追加
    this.dom.prizeList.insertBefore(prizeItem, this.dom.prizeList.firstChild);
  }
}

// ページロード完了時にゲーム起動
window.addEventListener('DOMContentLoaded', () => {
  new GameApp();
});
