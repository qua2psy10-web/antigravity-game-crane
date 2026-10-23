const THREE = window.THREE;
const CANNON = window.CANNON;

// ぬいぐるみ景品の定義
const PLUSH_TYPES = [
  {
    name: 'Pink Bear',
    animal: 'bear',
    color: 0xff8da1,
    subColor: 0xffe4e8,
    score: 300,
    mass: 0.14
  },
  {
    name: 'Brown Bear',
    animal: 'bear',
    color: 0xc68642,
    subColor: 0xf5deb3,
    score: 250,
    mass: 0.14
  },
  {
    name: 'White Bunny',
    animal: 'bunny',
    color: 0xffffff,
    subColor: 0xffb6c1,
    score: 350,
    mass: 0.12
  },
  {
    name: 'Lavender Bunny',
    animal: 'bunny',
    color: 0xc8a2c8,
    subColor: 0xffe4e1,
    score: 400,
    mass: 0.12
  },
  {
    name: 'Mint Cat',
    animal: 'cat',
    color: 0x98ff98,
    subColor: 0xffffff,
    score: 350,
    mass: 0.13
  },
  {
    name: 'Lemon Chick',
    animal: 'chick',
    color: 0xffe135,
    subColor: 0xff9500,
    score: 500,
    mass: 0.11
  }
];

export class PrizeManager {
  constructor(worldManager) {
    this.wm = worldManager;
    this.prizes = [];
    this.prizeCount = 12; // ぬいぐるみの総数
    this.time = 0;
  }

  // ぬいぐるみを生成して山積みにする
  spawnPrizes() {
    this.clearAllPrizes();

    const minX = -0.6;
    const maxX = 1.65;
    const minZ = -1.65;
    const maxZ = 0.8;

    for (let i = 0; i < this.prizeCount; i++) {
      const config = PLUSH_TYPES[i % PLUSH_TYPES.length];

      // グリッド＋ランダムオフセットで重なりすぎないように配置
      const col = i % 3;
      const row = Math.floor(i / 3) % 2;
      const layer = Math.floor(i / 6);

      const rx = minX + (col + 0.3 + Math.random() * 0.4) * ((maxX - minX) / 3);
      const rz = minZ + (row + 0.3 + Math.random() * 0.4) * ((maxZ - minZ) / 2);
      const ry = 0.8 + layer * 1.1 + (i % 3) * 0.15;

      const plush = this.createPlush(config, rx, ry, rz, i);
      this.prizes.push(plush);
    }
  }

  // ぬいぐるみの3Dビジュアルメッシュを構築（ゲーム内＆コレクション表示で共通利用）
  buildPlushVisualMesh(config) {
    const innerGroup = new THREE.Group();

    const mainMat = new THREE.MeshStandardMaterial({
      color: config.color,
      roughness: 0.92,
      metalness: 0.02
    });
    const subMat = new THREE.MeshStandardMaterial({
      color: config.subColor,
      roughness: 0.9,
      metalness: 0.02
    });
    const eyeMat = new THREE.MeshStandardMaterial({
      color: 0x1a1a1a,
      roughness: 0.2,
      metalness: 0.3
    });
    const blushMat = new THREE.MeshBasicMaterial({
      color: 0xff5577,
      transparent: true,
      opacity: 0.55
    });

    // 胴体 (Y: -0.18, 少しぽっちゃり)
    const torsoMesh = new THREE.Mesh(new THREE.SphereGeometry(0.30, 20, 20), mainMat);
    torsoMesh.scale.set(1.05, 0.95, 0.95);
    torsoMesh.position.set(0, -0.18, 0);
    torsoMesh.castShadow = true;
    torsoMesh.receiveShadow = true;
    innerGroup.add(torsoMesh);

    // お腹のパッチ
    const bellyMesh = new THREE.Mesh(new THREE.SphereGeometry(0.21, 16, 16), subMat);
    bellyMesh.scale.set(0.9, 0.85, 0.5);
    bellyMesh.position.set(0, -0.18, 0.21);
    innerGroup.add(bellyMesh);

    // 頭 (Y: +0.22, 大きめでツメが引っかかりやすいくびれを作る)
    const headMesh = new THREE.Mesh(new THREE.SphereGeometry(0.32, 24, 24), mainMat);
    headMesh.scale.set(1.08, 0.98, 1.0);
    headMesh.position.set(0, 0.22, 0);
    headMesh.castShadow = true;
    headMesh.receiveShadow = true;
    innerGroup.add(headMesh);

    // 目
    const leftEye = new THREE.Mesh(new THREE.SphereGeometry(0.042, 12, 12), eyeMat);
    leftEye.position.set(-0.12, 0.26, 0.29);
    const rightEye = leftEye.clone();
    rightEye.position.x = 0.12;
    innerGroup.add(leftEye, rightEye);

    // ほっぺ
    const leftBlush = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 12), blushMat);
    leftBlush.scale.set(1.2, 0.7, 0.3);
    leftBlush.position.set(-0.19, 0.19, 0.28);
    const rightBlush = leftBlush.clone();
    rightBlush.position.x = 0.19;
    innerGroup.add(leftBlush, rightBlush);

    // 口元（マズル・くちばし）
    if (config.animal === 'chick') {
      const beak = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.12, 12), subMat);
      beak.rotation.x = Math.PI / 2;
      beak.position.set(0, 0.20, 0.34);
      innerGroup.add(beak);
    } else {
      const snout = new THREE.Mesh(new THREE.SphereGeometry(0.09, 14, 14), subMat);
      snout.scale.set(1.2, 0.85, 0.7);
      snout.position.set(0, 0.18, 0.29);
      innerGroup.add(snout);

      const nose = new THREE.Mesh(new THREE.SphereGeometry(0.03, 10, 10), eyeMat);
      nose.position.set(0, 0.21, 0.35);
      innerGroup.add(nose);
    }

    // 耳・トサカ
    if (config.animal === 'bunny') {
      const earGeo = new THREE.SphereGeometry(0.11, 14, 14);
      const leftEar = new THREE.Mesh(earGeo, mainMat);
      leftEar.scale.set(0.65, 2.2, 0.5);
      leftEar.position.set(-0.15, 0.56, 0);
      leftEar.rotation.z = 0.15;
      leftEar.castShadow = true;

      const rightEar = leftEar.clone();
      rightEar.position.x = 0.15;
      rightEar.rotation.z = -0.15;
      innerGroup.add(leftEar, rightEar);
    } else if (config.animal === 'cat') {
      const earGeo = new THREE.ConeGeometry(0.13, 0.24, 12);
      const leftEar = new THREE.Mesh(earGeo, mainMat);
      leftEar.position.set(-0.22, 0.48, 0);
      leftEar.rotation.z = 0.35;
      leftEar.castShadow = true;

      const rightEar = leftEar.clone();
      rightEar.position.x = 0.22;
      rightEar.rotation.z = -0.35;
      innerGroup.add(leftEar, rightEar);
    } else if (config.animal === 'chick') {
      const tuft = new THREE.Mesh(new THREE.SphereGeometry(0.08, 12, 12), mainMat);
      tuft.scale.set(0.7, 1.5, 0.7);
      tuft.position.set(0, 0.54, 0);
      innerGroup.add(tuft);
    } else {
      // クマ耳
      const earGeo = new THREE.SphereGeometry(0.12, 14, 14);
      const leftEar = new THREE.Mesh(earGeo, mainMat);
      leftEar.position.set(-0.24, 0.46, 0);
      leftEar.castShadow = true;
      const rightEar = leftEar.clone();
      rightEar.position.x = 0.24;
      innerGroup.add(leftEar, rightEar);
    }

    // 手（横に広げてツメが脇の下に引っかかるようにする）
    const armGeo = new THREE.SphereGeometry(0.11, 12, 12);
    const leftArm = new THREE.Mesh(armGeo, mainMat);
    leftArm.scale.set(1.3, 0.85, 0.85);
    leftArm.position.set(-0.32, -0.10, 0.05);
    leftArm.rotation.z = 0.3;
    leftArm.castShadow = true;

    const rightArm = leftArm.clone();
    rightArm.position.x = 0.32;
    rightArm.rotation.z = -0.3;
    innerGroup.add(leftArm, rightArm);

    // 足
    const legGeo = new THREE.SphereGeometry(0.12, 12, 12);
    const leftLeg = new THREE.Mesh(legGeo, mainMat);
    leftLeg.scale.set(0.95, 0.85, 1.3);
    leftLeg.position.set(-0.18, -0.38, 0.14);
    leftLeg.castShadow = true;

    const rightLeg = leftLeg.clone();
    rightLeg.position.x = 0.18;
    innerGroup.add(leftLeg, rightLeg);

    return innerGroup;
  }

  // MY PRIZES コレクション用に、獲得したぬいぐるみの3Dフィギュア画像（DataURL）をレンダリングして生成
  renderPlushThumbnail(config) {
    if (!this.thumbRenderer) {
      this.thumbRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      this.thumbRenderer.setSize(160, 160);
      this.thumbRenderer.setPixelRatio(2);
    }

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 10);
    camera.position.set(0, 0.15, 2.2);
    camera.lookAt(0, 0.08, 0);

    const ambLight = new THREE.AmbientLight(0xffffff, 0.85);
    scene.add(ambLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.9);
    dirLight.position.set(2, 3, 3);
    scene.add(dirLight);

    const rimLight = new THREE.DirectionalLight(0xff8da1, 0.5);
    rimLight.position.set(-2, 1, -1);
    scene.add(rimLight);

    const figureMesh = this.buildPlushVisualMesh(config);
    // 少し斜め向きにして立体的にかわいく見せる
    figureMesh.rotation.y = -0.25;
    figureMesh.rotation.x = 0.08;
    scene.add(figureMesh);

    this.thumbRenderer.render(scene, camera);
    const dataUrl = this.thumbRenderer.domElement.toDataURL('image/png');

    // メモリ解放
    figureMesh.traverse((child) => {
      if (child.isMesh) {
        if (child.geometry) child.geometry.dispose();
        if (child.material) child.material.dispose();
      }
    });

    return dataUrl;
  }

  createPlush(config, x, y, z, id) {
    // 1. Three.js のビジュアルメッシュ作成
    const group = new THREE.Group();
    const innerGroup = this.buildPlushVisualMesh(config); // ぷにぷに変形アニメーション用
    group.add(innerGroup);

    // 2. Cannon.js の複合剛体（Compound Shape）作成
    // 頭と胴体のくびれ、耳や手足の出っ張りを物理形状として忠実に持たせることで、
    // 隙間のあるツメでも「首元・脇の下・耳」に引っかけて持ち上げられるようにする
    const body = new CANNON.Body({
      mass: config.mass,
      material: this.wm.plushMat,
      linearDamping: 0.35,  // ふわっとした空気抵抗・減衰
      angularDamping: 0.45
    });

    // 胴体コライダー
    body.addShape(new CANNON.Sphere(0.28), new CANNON.Vec3(0, -0.18, 0));
    // 頭コライダー（胴体との間に自然なくびれができる）
    body.addShape(new CANNON.Sphere(0.31), new CANNON.Vec3(0, 0.22, 0));
    // 両手コライダー
    body.addShape(new CANNON.Sphere(0.10), new CANNON.Vec3(-0.31, -0.10, 0.05));
    body.addShape(new CANNON.Sphere(0.10), new CANNON.Vec3(0.31, -0.10, 0.05));
    // 両足コライダー
    body.addShape(new CANNON.Sphere(0.11), new CANNON.Vec3(-0.18, -0.36, 0.12));
    body.addShape(new CANNON.Sphere(0.11), new CANNON.Vec3(0.18, -0.36, 0.12));
    // 両耳コライダー
    if (config.animal === 'bunny') {
      body.addShape(new CANNON.Sphere(0.10), new CANNON.Vec3(-0.15, 0.52, 0));
      body.addShape(new CANNON.Sphere(0.10), new CANNON.Vec3(0.15, 0.52, 0));
    } else {
      body.addShape(new CANNON.Sphere(0.11), new CANNON.Vec3(-0.23, 0.45, 0));
      body.addShape(new CANNON.Sphere(0.11), new CANNON.Vec3(0.23, 0.45, 0));
    }

    body.position.set(x, y, z);
    // 少しランダムに傾けて自然な山積みにする
    body.quaternion.setFromEuler(
      (Math.random() - 0.5) * 0.8,
      Math.random() * Math.PI * 2,
      (Math.random() - 0.5) * 0.8
    );

    group.position.copy(body.position);
    group.quaternion.copy(body.quaternion);

    this.wm.addBody(group, body);

    return {
      id,
      config,
      mesh: group,
      innerGroup,
      body,
      name: config.name,
      color: config.color,
      score: config.score,
      isGained: false,
      squishAmount: 0,
      lastVelY: 0
    };
  }

  // 毎フレームのぷにぷに変形（Squash & Stretch）と獲得チェック
  update(dt, crane) {
    this.time += dt;

    const clawCenter = new THREE.Vector3(crane.x, crane.y - 0.65, crane.z);
    const isClawPressing = crane.openAngle < 0.45;

    for (let i = 0; i < this.prizes.length; i++) {
      const p = this.prizes[i];
      if (p.isGained) continue;

      // 1. 着地や衝突時の速度変化でぷにっと潰れる演出
      const velY = p.body.velocity.y;
      const accelY = Math.abs(velY - p.lastVelY);
      p.lastVelY = velY;

      if (accelY > 1.2) {
        p.squishAmount = Math.min(0.28, p.squishAmount + accelY * 0.04);
      }

      // 2. ツメに挟まれているときにむぎゅっと柔らかそうに縮む演出
      const distToClaw = p.mesh.position.distanceTo(clawCenter);
      let pinchScaleXZ = 1.0;
      let pinchScaleY = 1.0;
      if (isClawPressing && distToClaw < 0.75) {
        const factor = (1.0 - distToClaw / 0.75) * 0.16;
        pinchScaleXZ = 1.0 - factor;
        pinchScaleY = 1.0 + factor * 0.8;
      }

      // 減衰しながら元の形に戻るバネ挙動
      p.squishAmount *= Math.pow(0.05, dt);

      const sY = (1.0 - p.squishAmount) * pinchScaleY;
      const sXZ = (1.0 + p.squishAmount * 0.6) * pinchScaleXZ;
      p.innerGroup.scale.set(sXZ, sY, sXZ);
    }
  }

  // 景品が落とし口に入ったかを毎フレームチェック
  checkGainedPrizes() {
    const gained = [];
    // 落とし口の境界（x: -2.5 〜 -0.85, z: 0.85 〜 2.5）
    const holeMaxX = -this.wm.machineWidth / 2 + this.wm.holeSize;
    const holeMinZ = this.wm.machineDepth / 2 - this.wm.holeSize;

    for (let i = 0; i < this.prizes.length; i++) {
      const prize = this.prizes[i];
      if (prize.isGained) continue;

      const pos = prize.body.position;

      // 穴のフチに半分以上かかっている場合、フチで引っかかって止まらないように穴の中心へ向かって少し滑り落とす力を加える
      if (pos.x < holeMaxX + 0.15 && pos.z > holeMinZ - 0.15 && pos.y < 0.45) {
        prize.body.wakeUp();
        prize.body.velocity.x -= 1.2 * (1 / 60);
        prize.body.velocity.z += 1.2 * (1 / 60);
      }

      // 穴の領域に入り、重心が床面付近（y < 0.15）まで下がったら獲得判定！
      if (pos.x < holeMaxX + 0.1 && pos.z > holeMinZ - 0.1 && pos.y < 0.15) {
        prize.isGained = true;
        gained.push(prize);
        this.animateGain(prize);
      }
    }

    return gained;
  }

  animateGain(prize) {
    const mesh = prize.mesh;
    const body = prize.body;

    body.mass = 0;
    body.type = CANNON.Body.STATIC;
    body.updateMassProperties();

    let scale = 1.0;
    const shrink = () => {
      scale -= 0.07;
      if (scale <= 0.05) {
        this.wm.removeBody(mesh, body);
        const idx = this.prizes.findIndex(p => p.id === prize.id);
        if (idx !== -1) {
          this.prizes.splice(idx, 1);
        }
      } else {
        mesh.scale.set(scale, scale, scale);
        mesh.position.y += 0.03;
        requestAnimationFrame(shrink);
      }
    };
    shrink();
  }

  clearAllPrizes() {
    this.prizes.forEach(prize => {
      this.wm.removeBody(prize.mesh, prize.body);
    });
    this.prizes = [];
  }
}
