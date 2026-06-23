const THREE = window.THREE;
const CANNON = window.CANNON;

// 景品データの定義
const PRIZE_TYPES = [
  {
    name: 'Red Capsule',
    type: 'capsule',
    color: 0xff3b30,
    score: 100,
    radius: 0.35,
    mass: 0.5
  },
  {
    name: 'Blue Capsule',
    type: 'capsule',
    color: 0x007aff,
    score: 100,
    radius: 0.35,
    mass: 0.5
  },
  {
    name: 'Yellow Capsule',
    type: 'capsule',
    color: 0xffcc00,
    score: 100,
    radius: 0.35,
    mass: 0.5
  },
  {
    name: 'Purple Capsule',
    type: 'capsule',
    color: 0xaf52de,
    score: 120,
    radius: 0.35,
    mass: 0.5
  },
  {
    name: 'Gift Box',
    type: 'box',
    color: 0xff9500,
    score: 200,
    size: 0.6,
    mass: 0.6
  },
  {
    name: 'Lucky Diamond',
    type: 'gem',
    color: 0x34c759,
    score: 500,
    radius: 0.3,
    mass: 0.4
  }
];

export class PrizeManager {
  constructor(worldManager) {
    this.wm = worldManager;
    this.prizes = [];
    this.prizeCount = 28; // 生成する景品の総数
  }

  // 景品を山積みにして生成
  spawnPrizes() {
    // 既存の景品があればクリアする
    this.clearAllPrizes();

    // 生成範囲
    // 落とし口 (x: -2.5 〜 -1.0, z: 1.0 〜 2.5) を避けて、
    // 主に中央〜奥〜右側に山積みになるように配置する
    const minX = -0.8;
    const maxX = 1.8;
    const minZ = -1.8;
    const maxZ = 0.8;

    for (let i = 0; i < this.prizeCount; i++) {
      // ランダムに景品タイプを選択
      const config = PRIZE_TYPES[Math.floor(Math.random() * PRIZE_TYPES.length)];
      
      // 少しばらつきを持たせたランダム位置
      const rx = minX + Math.random() * (maxX - minX);
      const rz = minZ + Math.random() * (maxZ - minZ);
      
      // 高さを段階的に変えて、上から落とすことで自然に積み重ねる
      // 最初の数個は低めに、徐々に高く
      const ry = 0.4 + (i * 0.18); 

      let mesh, body;

      if (config.type === 'capsule') {
        // カプセルの作成（上が半透明、下がカラーのプラスチック感）
        mesh = this.createCapsuleMesh(config.color, config.radius);
        
        // 物理ボディは単純な球体
        const shape = new CANNON.Sphere(config.radius);
        body = new CANNON.Body({
          mass: config.mass,
          shape: shape,
          linearDamping: 0.1,
          angularDamping: 0.1
        });
      } else if (config.type === 'box') {
        // ギフトボックスの作成
        mesh = this.createBoxMesh(config.color, config.size);
        
        const halfSize = config.size / 2;
        const shape = new CANNON.Box(new CANNON.Vec3(halfSize, halfSize, halfSize));
        body = new CANNON.Body({
          mass: config.mass,
          shape: shape,
          linearDamping: 0.1,
          angularDamping: 0.1
        });
      } else {
        // 宝石の作成
        mesh = this.createGemMesh(config.color, config.radius);
        
        // 物理ボディは球体で近似（転がりやすく掴みやすくする）
        const shape = new CANNON.Sphere(config.radius);
        body = new CANNON.Body({
          mass: config.mass,
          shape: shape,
          linearDamping: 0.1,
          angularDamping: 0.1
        });
      }

      // 位置を設定し、わずかにランダムな回転をかける
      body.position.set(rx, ry, rz);
      body.quaternion.setFromEuler(
        Math.random() * Math.PI,
        Math.random() * Math.PI,
        Math.random() * Math.PI
      );

      mesh.position.copy(body.position);
      mesh.quaternion.copy(body.quaternion);

      // シーンと物理世界に登録
      this.wm.addBody(mesh, body);

      this.prizes.push({
        id: i,
        mesh: mesh,
        body: body,
        name: config.name,
        color: config.color,
        score: config.score,
        isGained: false
      });
    }
  }

  // カプセル型のビジュアルメッシュ作成
  createCapsuleMesh(colorHex, radius) {
    const group = new THREE.Group();
    
    // 下半分：不透明のカラープラスチック
    const bottomGeo = new THREE.SphereGeometry(radius, 16, 16, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
    const bottomMat = new THREE.MeshStandardMaterial({
      color: colorHex,
      roughness: 0.2,
      metalness: 0.1
    });
    const bottomMesh = new THREE.Mesh(bottomGeo, bottomMat);
    bottomMesh.rotation.x = Math.PI; // 下に向ける
    bottomMesh.castShadow = true;
    bottomMesh.receiveShadow = true;
    group.add(bottomMesh);

    // 上半分：半透明のクリア乳白色プラスチック
    const topGeo = new THREE.SphereGeometry(radius, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2);
    const topMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.5,
      roughness: 0.1,
      metalness: 0.1
    });
    const topMesh = new THREE.Mesh(topGeo, topMat);
    topMesh.castShadow = true;
    group.add(topMesh);
    
    // 真ん中の黒い結合リング
    const ringGeo = new THREE.CylinderGeometry(radius + 0.01, radius + 0.01, 0.03, 16);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x222222 });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    group.add(ringMesh);

    return group;
  }

  // ギフトボックス型のビジュアルメッシュ作成
  createBoxMesh(colorHex, size) {
    const group = new THREE.Group();

    // 箱本体
    const boxGeo = new THREE.BoxGeometry(size, size, size);
    const boxMat = new THREE.MeshStandardMaterial({
      color: colorHex,
      roughness: 0.3,
      metalness: 0.1
    });
    const boxMesh = new THREE.Mesh(boxGeo, boxMat);
    boxMesh.castShadow = true;
    boxMesh.receiveShadow = true;
    group.add(boxMesh);

    // リボン（十文字に細いBoxを重ねる）
    const ribbonMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.4
    });
    const w = size + 0.01;
    const t = 0.08; // リボンの太さ
    
    const rib1 = new THREE.Mesh(new THREE.BoxGeometry(w, t, t), ribbonMat);
    const rib2 = new THREE.Mesh(new THREE.BoxGeometry(t, w, t), ribbonMat);
    const rib3 = new THREE.Mesh(new THREE.BoxGeometry(t, t, w), ribbonMat);
    group.add(rib1, rib2, rib3);
    
    // 天面のリボン結び（小さな球体）
    const bow = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), ribbonMat);
    bow.position.y = size / 2;
    group.add(bow);

    return group;
  }

  // 宝石型のビジュアルメッシュ作成
  createGemMesh(colorHex, radius) {
    // 20面体（正二十面体）を使用してクリスタルの質感を表現
    const gemGeo = new THREE.IcosahedronGeometry(radius, 0);
    const gemMat = new THREE.MeshStandardMaterial({
      color: colorHex,
      roughness: 0.1,
      metalness: 0.8,
      transparent: true,
      opacity: 0.8
    });
    const mesh = new THREE.Mesh(gemGeo, gemMat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }

  // 景品が落とし口に入ったかを毎フレームチェック
  checkGainedPrizes() {
    const gained = [];
    
    // 穴の境界（ワールド座標）:
    // x: -2.5 〜 -1.0 (穴の右端が -1.0)
    // z: 1.0 〜 2.5 (穴の奥端が 1.0)
    // y: 底面が y=0。穴に落ちると y < 0 になる。
    
    for (let i = 0; i < this.prizes.length; i++) {
      const prize = this.prizes[i];
      if (prize.isGained) continue;

      const pos = prize.body.position;
      
      // 穴のXY範囲に入っており、yが0より低い（落下している）場合
      if (pos.x < -0.9 && pos.z > 0.9 && pos.y < 0.1) {
        prize.isGained = true;
        gained.push(prize);
        
        // 獲得時のビジュアルエフェクト（縮小アニメーション）
        this.animateGain(prize);
      }
    }
    
    return gained;
  }

  // 獲得した景品を小さくして消滅させるアニメーション
  animateGain(prize) {
    const mesh = prize.mesh;
    const body = prize.body;
    
    // 物理シミュレーションを無効化（固定する、または衝突判定をなくす）
    body.mass = 0;
    body.type = CANNON.Body.STATIC;
    body.updateMassProperties();
    
    let scale = 1.0;
    
    const shrink = () => {
      scale -= 0.08;
      if (scale <= 0.05) {
        // シーンと物理世界から完全に削除
        this.wm.removeBody(mesh, body);
        
        // 管理リストから除外
        const idx = this.prizes.findIndex(p => p.id === prize.id);
        if (idx !== -1) {
          this.prizes.splice(idx, 1);
        }
      } else {
        mesh.scale.set(scale, scale, scale);
        // 上昇しながら消えるエフェクト
        mesh.position.y += 0.03;
        requestAnimationFrame(shrink);
      }
    };
    
    shrink();
  }

  // 全ての景品をクリア
  clearAllPrizes() {
    this.prizes.forEach(prize => {
      this.wm.removeBody(prize.mesh, prize.body);
    });
    this.prizes = [];
  }
}
