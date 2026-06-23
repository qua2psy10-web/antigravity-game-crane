const THREE = window.THREE;
const CANNON = window.CANNON;

export class CraneManager {
  constructor(worldManager) {
    this.wm = worldManager;
    
    // 移動制限
    this.minX = -1.75; // 落とし口のX座標（初期位置）
    this.maxX = 2.0;
    this.minZ = -2.0;
    this.maxZ = 1.75;  // 落とし口のZ座標（初期位置）
    
    this.homeX = this.minX;
    this.homeZ = this.maxZ;
    this.startY = 5.5; // 初期（天面近く）の高さ
    
    // 現在位置
    this.x = this.homeX;
    this.z = this.homeZ;
    this.y = this.startY;
    
    // 状態管理
    this.speed = 1.5;
    this.dropSpeed = 1.2;
    this.liftSpeed = 1.0;
    this.openAngle = 0.6; // 爪の開き度合い（ラジアン）
    this.targetOpenAngle = 0.6;
    
    // 掴んだ景品の参照と物理的な接続（制約）
    this.grabbedPrize = null;
    this.grabConstraint = null;
    this.grabStrength = 0.5; // 景品を保持する強さ（確率や時間で落ちるようにする調整用）
    
    this.createCraneModels();
  }

  createCraneModels() {
    const metalMat = new THREE.MeshStandardMaterial({
      color: 0xcccccc,
      metalness: 0.9,
      roughness: 0.1
    });
    
    const neonPink = new THREE.MeshBasicMaterial({ color: 0xff007f });
    
    // 1. キャリッジ（天井を動く台座）
    this.carriageMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.8, 0.2, 0.8),
      metalMat
    );
    this.carriageMesh.position.set(this.x, this.startY + 0.5, this.z);
    this.wm.scene.add(this.carriageMesh);
    
    // 2. アームヘッド（クローの付け根）の物理ボディ
    // 物理エンジンで景品を検知・衝突するためにKinematicボディとして設定
    const headRadius = 0.4;
    this.headMesh = new THREE.Mesh(
      new THREE.SphereGeometry(headRadius, 16, 16),
      new THREE.MeshStandardMaterial({ color: 0xff007f, metalness: 0.5, roughness: 0.2 })
    );
    this.headMesh.castShadow = true;
    
    const headShape = new CANNON.Sphere(headRadius);
    this.headBody = new CANNON.Body({
      mass: 0, // 静的またはKinematicに制御するため0にする
      type: CANNON.Body.KINEMATIC,
      shape: headShape
    });
    this.headBody.position.set(this.x, this.y, this.z);
    
    // 物理世界とThree.jsの同期に登録
    this.wm.addBody(this.headMesh, this.headBody);
    
    // 3. ワイヤー（ビジュアルのみ。キャリッジとヘッドを繋ぐ）
    const wireGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 1, 0)
    ]);
    const wireMat = new THREE.LineBasicMaterial({ color: 0x888888 });
    this.wire = new THREE.Line(wireGeo, wireMat);
    this.wm.scene.add(this.wire);
    
    // 4. 爪 (3本の指) の作成
    // 各指はheadMeshの子オブジェクトとして作成し、角度を変更することでアニメーションする
    this.claws = [];
    const numClaws = 3;
    
    for (let i = 0; i < numClaws; i++) {
      const clawGroup = new THREE.Group();
      // アームヘッドの周りに120度間隔で配置
      const angle = (i * Math.PI * 2) / numClaws;
      clawGroup.rotation.y = angle;
      
      // 爪のパーツ1: 根元から斜め下へ伸びる棒
      const upperClaw = new THREE.Mesh(
        new THREE.CylinderGeometry(0.04, 0.04, 0.5),
        metalMat
      );
      upperClaw.position.set(0.2, -0.2, 0);
      upperClaw.rotation.z = -0.3; // 外側に少し開く
      clawGroup.add(upperClaw);
      
      // 爪のパーツ2: 内側に曲がった先の爪
      const lowerClaw = new THREE.Mesh(
        new THREE.CylinderGeometry(0.04, 0.01, 0.4),
        metalMat
      );
      lowerClaw.position.set(0.3, -0.5, 0);
      lowerClaw.rotation.z = 0.5; // 内側に曲げる
      clawGroup.add(lowerClaw);
      
      // 先端にゴムキャップのような滑り止め（ビジュアル）
      const tip = new THREE.Mesh(
        new THREE.SphereGeometry(0.05, 8, 8),
        new THREE.MeshBasicMaterial({ color: 0x00f0ff })
      );
      tip.position.set(0.2, -0.68, 0);
      clawGroup.add(tip);
      
      // ヘッドの子にする
      this.headMesh.add(clawGroup);
      this.claws.push(clawGroup);
    }
  }

  // クレーンの位置とワイヤーの描画更新
  update(dt, currentState) {
    // 物理ボディの座標をプログラム側（X, Y, Z）に更新
    this.headBody.position.set(this.x, this.y, this.z);
    
    // 台座（キャリッジ）はアームの真上（天井付近）を追従
    this.carriageMesh.position.set(this.x, this.startY + 0.5, this.z);
    
    // ワイヤーの長さを更新
    const wirePositions = this.wire.geometry.attributes.position;
    // 始点: キャリッジの位置（ローカル座標またはワールド座標から調整）
    wirePositions.setXYZ(0, this.x, this.startY + 0.4, this.z);
    // 終点: アームヘッドの位置
    wirePositions.setXYZ(1, this.x, this.y, this.z);
    wirePositions.needsUpdate = true;
    
    // 爪の開閉アニメーション
    // 目標角度に向けて徐々に回転させる（補間）
    this.openAngle += (this.targetOpenAngle - this.openAngle) * 0.1;
    this.claws.forEach((claw) => {
      // 爪のZ回転を開き角度に連動させる
      // 開いているときは外側に開き、閉じているときは内側にする
      claw.children[0].rotation.z = -this.openAngle;
      // 先端部分もそれに合わせて調整
      claw.children[1].rotation.z = this.openAngle * 0.8;
      claw.children[1].position.set(
        Math.sin(this.openAngle) * 0.4 + 0.1,
        -Math.cos(this.openAngle) * 0.5,
        0
      );
      claw.children[2].position.set(
        Math.sin(this.openAngle) * 0.4 + 0.05,
        -Math.cos(this.openAngle) * 0.5 - 0.18,
        0
      );
    });

    // 掴んだ景品が接続されている場合、アームの揺れに合わせて多少動きを安定させる
    if (this.grabbedPrize && this.grabConstraint) {
      // アームが上昇・移動する際、たまに「するっと落ちる」効果を演出
      // 急な移動や上昇のタイミングでランダムにジョイントが切れるスリルを作る
      if (currentState === 'LIFTING' || currentState === 'RETURNING') {
        const dropChance = 0.0008 * (1.0 - this.grabStrength); // 確率
        if (Math.random() < dropChance) {
          this.releasePrize();
        }
      }
    }
  }

  // X方向（右）へ移動
  moveRight(dt) {
    this.x += this.speed * dt;
    if (this.x > this.maxX) this.x = this.maxX;
  }

  // Z方向（奥）へ移動
  moveForward(dt) {
    this.z -= this.speed * dt; // Z負方向が奥
    if (this.z < this.minZ) this.z = this.minZ;
  }

  // 初期位置に戻る
  returnToHome(dt) {
    let homeReached = true;
    
    // X軸移動
    const dx = this.homeX - this.x;
    if (Math.abs(dx) > 0.05) {
      this.x += Math.sign(dx) * this.speed * dt;
      homeReached = false;
    } else {
      this.x = this.homeX;
    }
    
    // Z軸移動
    const dz = this.homeZ - this.z;
    if (Math.abs(dz) > 0.05) {
      this.z += Math.sign(dz) * this.speed * dt;
      homeReached = false;
    } else {
      this.z = this.homeZ;
    }
    
    return homeReached;
  }

  // アーム下降
  descend(dt, targetY) {
    this.y -= this.dropSpeed * dt;
    if (this.y < targetY) {
      this.y = targetY;
      return true; // 下降完了
    }
    return false;
  }

  // アーム上昇
  ascend(dt) {
    this.y += this.liftSpeed * dt;
    if (this.y > this.startY) {
      this.y = this.startY;
      return true; // 上昇完了
    }
    return false;
  }

  // 爪を開く
  open() {
    this.targetOpenAngle = 0.7; // 大きく開く
  }

  // 爪を閉じる
  close() {
    this.targetOpenAngle = 0.15; // 閉じる
  }

  // 周囲の景品を検知して掴む
  attemptGrab(prizes) {
    this.close();
    
    // 爪が閉じる時間を見越して少し待ってから判定するのが本来ですが、
    // ここで掴む対象の景品を物理ジョイントで接続します。
    // アームヘッド下部（爪の先端付近）のワールド座標
    const grabPoint = new CANNON.Vec3(this.x, this.y - 0.7, this.z);
    
    let closestPrize = null;
    let minDistance = 0.8; // 掴める最大半径 (この範囲内にある景品が対象)
    
    prizes.forEach(prize => {
      const dist = prize.body.position.vsub(grabPoint).length();
      if (dist < minDistance) {
        minDistance = dist;
        closestPrize = prize;
      }
    });
    
    if (closestPrize) {
      this.grabbedPrize = closestPrize;
      
      // アームと景品を物理ジョイント（PointToPointConstraint）で接続
      // ローカル座標での接続位置を計算
      const localPivotA = new CANNON.Vec3(0, -0.65, 0); // アームの中心から少し下
      
      // 景品のローカル座標系でのピボット（中心点）
      const localPivotB = new CANNON.Vec3(0, 0, 0);
      
      this.grabConstraint = new CANNON.PointToPointConstraint(
        this.headBody,
        localPivotA,
        this.grabbedPrize.body,
        localPivotB
      );
      
      // 物理世界に追加
      this.wm.physicsWorld.addConstraint(this.grabConstraint);
      
      // 景品の重さによって掴む強さ（キープ力）をランダムに決定
      // 景品ごとに設定されたベース摩擦などに依存
      this.grabStrength = 0.4 + Math.random() * 0.6; // 0.4 〜 1.0
      
      // 景品が少し揺れるように、減衰を設定できれば良いが、Cannon.jsのP2P制約はデフォルトで少し遊びがある
      console.log("Grabbed prize:", closestPrize.name);
      return true;
    }
    
    console.log("Nothing grabbed.");
    return false;
  }

  // 掴んでいる景品をリリースする（離す）
  releasePrize() {
    if (this.grabConstraint) {
      this.wm.physicsWorld.removeConstraint(this.grabConstraint);
      this.grabConstraint = null;
    }
    this.grabbedPrize = null;
    this.open();
    console.log("Released prize.");
  }
}
