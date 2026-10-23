const THREE = window.THREE;
const CANNON = window.CANNON;

export class CraneManager {
  constructor(worldManager) {
    this.wm = worldManager;

    // 移動制限
    this.minX = -1.65; // 落とし口のX座標（初期位置）
    this.maxX = 1.85;
    this.minZ = -1.85;
    this.maxZ = 1.65;  // 落とし口のZ座標（初期位置）

    this.homeX = this.minX;
    this.homeZ = this.maxZ;
    this.startY = 5.4; // 初期の高さ

    // 現在位置
    this.x = this.homeX;
    this.z = this.homeZ;
    this.y = this.startY;

    // 速度設定
    this.speed = 1.6;
    this.dropSpeed = 1.35;
    this.liftSpeed = 1.05;

    // ★ ツメの開閉角度（ラジアン）
    // 閉じたときは minCloseAngle = 0.04（先端同士がくっつかず、小さな隙間が残る角度）に設定
    this.maxOpenAngle = 0.65;   // 大きく開いた状態
    this.minCloseAngle = 0.04;  // 閉じた状態（しっかり内側に回り込みつつ、先端同士の間には隙間が残る）
    this.openAngle = this.maxOpenAngle;
    this.targetOpenAngle = this.maxOpenAngle;

    this.createCraneModels();
  }

  createCraneModels() {
    const metalMat = new THREE.MeshStandardMaterial({
      color: 0xd8dce6,
      metalness: 0.85,
      roughness: 0.18
    });

    const headMat = new THREE.MeshStandardMaterial({
      color: 0xff2d55,
      metalness: 0.4,
      roughness: 0.25
    });

    const tipMat = new THREE.MeshStandardMaterial({
      color: 0x00f0ff,
      roughness: 0.4,
      metalness: 0.1,
      emissive: 0x00f0ff,
      emissiveIntensity: 0.25
    });

    // 1. キャリッジ（天井のレールを動く台座）
    this.carriageMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.85, 0.22, 0.85),
      metalMat
    );
    this.carriageMesh.position.set(this.x, this.startY + 0.5, this.z);
    this.wm.scene.add(this.carriageMesh);

    // 2. アームヘッド＋3本ツメのビジュアルグループ
    this.craneGroup = new THREE.Group();
    this.craneGroup.position.set(this.x, this.y, this.z);
    this.wm.scene.add(this.craneGroup);

    const headMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.32, 0.38, 0.36, 20),
      headMat
    );
    headMesh.castShadow = true;
    this.craneGroup.add(headMesh);

    // 3. 物理ボディ（KINEMATIC）
    this.clawBody = new CANNON.Body({
      mass: 0,
      type: CANNON.Body.KINEMATIC,
      material: this.wm.clawMat
    });
    this.clawBody.position.set(this.x, this.y, this.z);

    // ヘッド中心の物理球（Index 0）
    this.clawBody.addShape(new CANNON.Sphere(0.32), new CANNON.Vec3(0, 0, 0));

    // 4. 3本のツメ（120度間隔）と各ツメの物理コライダー球の構築
    this.numClaws = 3;
    this.claws = [];
    this.clawAngles = [];

    // 各ツメの物理コライダー配列（密度を高め、先端に「内向きの返し（スプーン状の受け皿）」を追加）
    // minCloseAngle = 0.04 のときでも先端は r ≈ 0.11 で止まり、中央に約22cm相当の隙間が空きつつ、
    // ぬいぐるみの首や胴体の下にしっかり潜り込んで支えられる形状
    this.baseClawPoints = [
      { r: 0.36, y: -0.24, radius: 0.060 }, // 上部アーム中間
      { r: 0.46, y: -0.44, radius: 0.075 }, // 関節（エルボー）
      { r: 0.36, y: -0.60, radius: 0.075 }, // 下部ツメ上部
      { r: 0.24, y: -0.74, radius: 0.080 }, // 下部ツメ中間（すくい面）
      { r: 0.14, y: -0.85, radius: 0.085 }, // ツメ先端のラバーパッド
      { r: 0.09, y: -0.87, radius: 0.075 }  // 先端の内側返し（下から支えるフック）
    ];

    for (let i = 0; i < this.numClaws; i++) {
      const yaw = (i * Math.PI * 2) / this.numClaws + Math.PI / 6;
      this.clawAngles.push(yaw);

      // 回転のルートグループ（Y軸で120度ずつ配置）
      const yawGroup = new THREE.Group();
      yawGroup.rotation.y = yaw;

      // 開閉ヒンジグループ（付け根 r=0.28, y=-0.08 を中心に Z軸回転で開閉する）
      const pivotGroup = new THREE.Group();
      pivotGroup.position.set(0.28, -0.08, 0);

      // 上部アームメッシュ
      const upperLen = 0.43;
      const upperMesh = new THREE.Mesh(
        new THREE.CylinderGeometry(0.04, 0.045, upperLen, 12),
        metalMat
      );
      // 付け根(0,0,0) から エルボー(0.20, -0.38, 0) へ配置
      upperMesh.position.set(0.10, -0.19, 0);
      upperMesh.rotation.z = Math.atan2(0.20, 0.38);
      upperMesh.castShadow = true;
      pivotGroup.add(upperMesh);

      // エルボー関節メッシュ
      const elbowMesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.055, 12, 12),
        metalMat
      );
      elbowMesh.position.set(0.20, -0.38, 0);
      pivotGroup.add(elbowMesh);

      // 下部ツメメッシュ（内側にカーブしてすくい上げる形状）
      const lowerLen = 0.56;
      const lowerMesh = new THREE.Mesh(
        new THREE.CylinderGeometry(0.042, 0.025, lowerLen, 12),
        metalMat
      );
      // エルボー(0.20, -0.38, 0) から 先端(-0.21, -0.80, 0) へ配置
      lowerMesh.position.set(-0.005, -0.59, 0);
      lowerMesh.rotation.z = -Math.atan2(0.41, 0.42);
      lowerMesh.castShadow = true;
      pivotGroup.add(lowerMesh);

      // 先端のラバーキャップ（少し平らな引っかかりを作る）
      const tipMesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.06, 12, 12),
        tipMat
      );
      tipMesh.scale.set(1.2, 0.8, 1.1);
      tipMesh.position.set(-0.21, -0.80, 0);
      pivotGroup.add(tipMesh);

      yawGroup.add(pivotGroup);
      this.craneGroup.add(yawGroup);
      this.claws.push(pivotGroup);

      // このツメに対応する物理球コライダーを clawBody に追加
      for (let j = 0; j < this.baseClawPoints.length; j++) {
        const pt = this.baseClawPoints[j];
        this.clawBody.addShape(new CANNON.Sphere(pt.radius), new CANNON.Vec3(0, -0.5, 0));
      }
    }

    this.wm.physicsWorld.addBody(this.clawBody);

    // 5. ワイヤー
    const wireGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(this.x, this.startY + 0.4, this.z),
      new THREE.Vector3(this.x, this.y, this.z)
    ]);
    const wireMat = new THREE.LineBasicMaterial({ color: 0xaaaaaa });
    this.wire = new THREE.Line(wireGeo, wireMat);
    this.wm.scene.add(this.wire);

    // 初回のコライダー位置更新
    this.updateClawPhysicsShapes();
  }

  // 現在の openAngle に応じて、物理ボディ内の各ツメの球体コライダーのオフセット座標を更新
  updateClawPhysicsShapes() {
    const pivotR = 0.28;
    const pivotY = -0.08;
    const cosA = Math.cos(this.openAngle);
    const sinA = Math.sin(this.openAngle);

    let shapeIdx = 1; // 0番目はヘッド中心の球体
    for (let i = 0; i < this.numClaws; i++) {
      const yaw = this.clawAngles[i];
      const cosYaw = Math.cos(yaw);
      const sinYaw = Math.sin(yaw);

      for (let j = 0; j < this.baseClawPoints.length; j++) {
        const pt = this.baseClawPoints[j];
        // ピボットからの相対座標
        const relR = pt.r - pivotR;
        const relY = pt.y - pivotY;

        // Z軸回転（openAngle が増えると外側＋上方向へ開く）
        const rotR = pivotR + (relR * cosA - relY * sinA);
        const rotY = pivotY + (relR * sinA + relY * cosA);

        // Y軸回転（3方向への展開）
        const wx = rotR * cosYaw;
        const wz = -rotR * sinYaw;

        this.clawBody.shapeOffsets[shapeIdx].set(wx, rotY, wz);
        shapeIdx++;
      }
    }
    this.clawBody.updateBoundingRadius();
  }

  update(dt, currentState) {
    const prevX = this.clawBody.position.x;
    const prevY = this.clawBody.position.y;
    const prevZ = this.clawBody.position.z;

    // 物理ボディの位置と速度を更新（KINEMATICボディが正しく摩擦と押し出し力を発揮できるように速度もセット）
    this.clawBody.position.set(this.x, this.y, this.z);
    if (dt > 0.0001) {
      this.clawBody.velocity.set(
        (this.x - prevX) / dt,
        (this.y - prevY) / dt,
        (this.z - prevZ) / dt
      );
    }

    // Three.js の描画位置を更新
    this.craneGroup.position.set(this.x, this.y, this.z);
    this.carriageMesh.position.set(this.x, this.startY + 0.5, this.z);

    // ワイヤー更新
    const wirePositions = this.wire.geometry.attributes.position;
    wirePositions.setXYZ(0, this.x, this.startY + 0.4, this.z);
    wirePositions.setXYZ(1, this.x, this.y, this.z);
    wirePositions.needsUpdate = true;

    // ツメの開閉アニメーション（閉じる時はぬいぐるみをしっかり挟み込む速度で動かす）
    const lerpSpeed = this.targetOpenAngle < this.openAngle ? 4.5 : 6.0;
    this.openAngle += (this.targetOpenAngle - this.openAngle) * Math.min(1.0, lerpSpeed * dt);

    // ビジュアルのツメ回転更新
    for (let i = 0; i < this.claws.length; i++) {
      this.claws[i].rotation.z = this.openAngle;
    }

    // 物理コライダーのツメ形状を更新
    this.updateClawPhysicsShapes();
  }

  moveRight(dt) {
    this.x += this.speed * dt;
    if (this.x > this.maxX) this.x = this.maxX;
  }

  moveForward(dt) {
    this.z -= this.speed * dt;
    if (this.z < this.minZ) this.z = this.minZ;
  }

  returnToHome(dt) {
    let homeReached = true;

    const dx = this.homeX - this.x;
    if (Math.abs(dx) > 0.05) {
      this.x += Math.sign(dx) * this.speed * dt;
      homeReached = false;
    } else {
      this.x = this.homeX;
    }

    const dz = this.homeZ - this.z;
    if (Math.abs(dz) > 0.05) {
      this.z += Math.sign(dz) * this.speed * dt;
      homeReached = false;
    } else {
      this.z = this.homeZ;
    }

    return homeReached;
  }

  // ぬいぐるみの山の高さや床に合わせて降下する
  descend(dt, targetY, prizes) {
    this.y -= this.dropSpeed * dt;

    // 真下にぬいぐるみがあるかチェックし、胴体の下までツメがしっかり潜り込む深さで止める
    if (prizes) {
      for (let i = 0; i < prizes.length; i++) {
        const p = prizes[i];
        if (p.isGained) continue;
        const dx = p.body.position.x - this.x;
        const dz = p.body.position.z - this.z;
        const horizontalDist = Math.sqrt(dx * dx + dz * dz);
        // ぬいぐるみの真上付近にある場合、ツメの先端(y - 0.87)がぬいぐるみの下半身・首の下まで届く高さ(p.y + 0.42)までしっかり降ろす
        if (horizontalDist < 0.38) {
          const dynamicTargetY = Math.max(targetY, p.body.position.y + 0.42);
          if (this.y <= dynamicTargetY) {
            this.y = dynamicTargetY;
            return true;
          }
        }
      }
    }

    if (this.y <= targetY) {
      this.y = targetY;
      return true;
    }
    return false;
  }

  ascend(dt) {
    this.y += this.liftSpeed * dt;
    if (this.y >= this.startY) {
      this.y = this.startY;
      return true;
    }
    return false;
  }

  // ツメを大きく開く
  open() {
    this.targetOpenAngle = this.maxOpenAngle;
  }

  // ツメを閉じる（完全には閉じず、minCloseAngle の隙間を残す）
  close() {
    this.targetOpenAngle = this.minCloseAngle;
  }

  // 物理的なツメの挟み込みを開始（人工的なConstraint吸着は使わず、純粋にツメの形状と摩擦で掴む）
  attemptGrab() {
    this.close();
  }

  // ツメを開いてぬいぐるみを離す
  releasePrize() {
    this.open();
  }
}
