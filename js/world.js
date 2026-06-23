
const THREE = window.THREE;
const CANNON = window.CANNON;

export class WorldManager {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.syncObjects = [];
    this.physicsWorld = null;
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;
    
    // 筐体サイズ設定
    this.machineWidth = 5;
    this.machineDepth = 5;
    this.machineHeight = 7;
    
    // 穴（落とし口）の設定
    // 左手前コーナーに配置: x: -2.5 〜 -1.0, z: 1.0 〜 2.5
    this.holeSize = 1.5;
    
    this.initThree();
    this.initPhysics();
    this.createEnvironment();
  }

  initThree() {
    // 1. シーン作成
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0f081d);
    // 奥ゆきを出すためのフォグ
    this.scene.fog = new THREE.FogExp2(0x0f081d, 0.035);

    // 2. カメラ作成
    this.camera = new THREE.PerspectiveCamera(
      45,
      this.container.clientWidth / this.container.clientHeight,
      0.1,
      100
    );
    // 筐体を斜め上から見下ろす位置
    this.camera.position.set(0, 5, 8.5);

    // 3. レンダラー作成
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.container.appendChild(this.renderer.domElement);

    // 4. カメラコントロール (OrbitControls) - ユーザーが視点を調整できるように
    this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    // 視点の移動角度を制限（地面にめり込まないように、また裏に回らないように）
    this.controls.minDistance = 4;
    this.controls.maxDistance = 12;
    this.controls.minPolarAngle = Math.PI / 6; // 30度
    this.controls.maxPolarAngle = Math.PI / 2.1; // 地面すれすれまで
    this.controls.minAzimuthAngle = -Math.PI / 4; // 左右45度
    this.controls.maxAzimuthAngle = Math.PI / 4;
    this.controls.target.set(0, 2, 0);
    this.controls.update();

    // 5. ライト設定
    // 環境光
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    this.scene.add(ambientLight);

    // メインのディレクショナルライト（影を作る用、上から照らす）
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(5, 10, 5);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 25;
    const d = 4;
    dirLight.shadow.camera.left = -d;
    dirLight.shadow.camera.right = d;
    dirLight.shadow.camera.top = d;
    dirLight.shadow.camera.bottom = -d;
    dirLight.shadow.bias = -0.0005;
    this.scene.add(dirLight);

    // ネオン風スポットライト（カラフルな発光）
    const spotLight1 = new THREE.SpotLight(0xff007f, 5, 15, Math.PI / 3, 0.5, 1);
    spotLight1.position.set(-3, 6, 3);
    this.scene.add(spotLight1);

    const spotLight2 = new THREE.SpotLight(0x00f0ff, 5, 15, Math.PI / 3, 0.5, 1);
    spotLight2.position.set(3, 6, 3);
    this.scene.add(spotLight2);

    // リサイズハンドラ
    window.addEventListener('resize', () => this.onWindowResize());
  }

  initPhysics() {
    this.physicsWorld = new CANNON.World();
    this.physicsWorld.gravity.set(0, -9.82, 0);
    
    // パフォーマンス最適化
    this.physicsWorld.broadphase = new CANNON.NaiveBroadphase();
    // 反復回数を高めにして衝突を安定化
    this.physicsWorld.solver.iterations = 10;
    
    // デフォルト接触資料の作成（滑りにくく、少し跳ねる程度に）
    const defaultMaterial = new CANNON.Material('default');
    const contactMaterial = new CANNON.ContactMaterial(
      defaultMaterial,
      defaultMaterial,
      {
        friction: 0.4,
        restitution: 0.1,
        contactEquationStiffness: 1e7,
        contactEquationRelaxation: 3
      }
    );
    this.physicsWorld.addContactMaterial(contactMaterial);
    this.physicsWorld.defaultContactMaterial = contactMaterial;
  }

  createEnvironment() {
    // 1. 床と壁の素材
    const wallMaterial = new THREE.MeshStandardMaterial({
      color: 0x1e153a,
      roughness: 0.7,
      metalness: 0.2
    });
    
    const glassMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.2,
      roughness: 0.1,
      metalness: 0.1,
      depthWrite: false
    });

    const neonPinkMaterial = new THREE.MeshBasicMaterial({ color: 0xff007f });
    const neonCyanMaterial = new THREE.MeshBasicMaterial({ color: 0x00f0ff });

    // 2. 物理底面（穴あき床）の作成
    // 筐体サイズ: 5x5、穴: 左手前コーナー 1.5x1.5 (x: -2.5〜-1.0, z: 1.0〜2.5)
    // 床1: 右半分を覆う (幅: 3.5, 奥行: 5, 位置: x=0.75, z=0)
    // 床2: 左奥半分を覆う (幅: 1.5, 奥行: 3.5, 位置: x=-1.75, z=-0.75)
    
    const floor1Thickness = 0.4;
    
    // 床1 (右側)
    const f1Width = 5.0 - this.holeSize; // 3.5
    const f1Depth = 5.0;
    const floor1Mesh = new THREE.Mesh(
      new THREE.BoxGeometry(f1Width, floor1Thickness, f1Depth),
      wallMaterial
    );
    floor1Mesh.position.set((this.machineWidth / 2) - (f1Width / 2), 0, 0); // x: 0.75, y: 0, z: 0
    floor1Mesh.receiveShadow = true;
    this.scene.add(floor1Mesh);

    const floor1Shape = new CANNON.Box(new CANNON.Vec3(f1Width / 2, floor1Thickness / 2, f1Depth / 2));
    const floor1Body = new CANNON.Body({ mass: 0, shape: floor1Shape });
    floor1Body.position.copy(floor1Mesh.position);
    this.physicsWorld.addBody(floor1Body);

    // 床2 (左奥)
    const f2Width = this.holeSize; // 1.5
    const f2Depth = 5.0 - this.holeSize; // 3.5
    const floor2Mesh = new THREE.Mesh(
      new THREE.BoxGeometry(f2Width, floor1Thickness, f2Depth),
      wallMaterial
    );
    // 左端に寄せて、奥（z負方向）に寄せる
    floor2Mesh.position.set(-(this.machineWidth / 2) + (f2Width / 2), 0, -(this.machineDepth / 2) + (f2Depth / 2)); // x: -1.75, y: 0, z: -0.75
    floor2Mesh.receiveShadow = true;
    this.scene.add(floor2Mesh);

    const floor2Shape = new CANNON.Box(new CANNON.Vec3(f2Width / 2, floor1Thickness / 2, f2Depth / 2));
    const floor2Body = new CANNON.Body({ mass: 0, shape: floor2Shape });
    floor2Body.position.copy(floor2Mesh.position);
    this.physicsWorld.addBody(floor2Body);

    // 落とし口のガイド境界線（ネオンイエロー）の作成
    const borderMat = new THREE.MeshBasicMaterial({ color: 0xffcc00 });
    const borderThickness = 0.08;
    
    // 右側の境界線
    const rBorder = new THREE.Mesh(
      new THREE.BoxGeometry(borderThickness, borderThickness, this.holeSize),
      borderMat
    );
    rBorder.position.set(-1.0, 0.21, 1.75);
    this.scene.add(rBorder);

    // 奥側の境界線
    const bBorder = new THREE.Mesh(
      new THREE.BoxGeometry(this.holeSize, borderThickness, borderThickness),
      borderMat
    );
    bBorder.position.set(-1.75, 0.21, 1.0);
    this.scene.add(bBorder);

    // 3. 落とし口の底（景品受け口）の作成
    // 穴に落ちた景品が下に留まるように、y = -1.5 に小さな床を作る
    const catchFloorMesh = new THREE.Mesh(
      new THREE.BoxGeometry(this.holeSize, 0.2, this.holeSize),
      new THREE.MeshStandardMaterial({ color: 0x090514, roughness: 0.9 })
    );
    catchFloorMesh.position.set(
      -(this.machineWidth / 2) + (this.holeSize / 2),
      -1.5,
      (this.machineDepth / 2) - (this.holeSize / 2)
    );
    this.scene.add(catchFloorMesh);

    const catchFloorShape = new CANNON.Box(new CANNON.Vec3(this.holeSize / 2, 0.1, this.holeSize / 2));
    const catchFloorBody = new CANNON.Body({ mass: 0, shape: catchFloorShape });
    catchFloorBody.position.copy(catchFloorMesh.position);
    this.physicsWorld.addBody(catchFloorBody);

    // 受け口の側壁（落ちたものが横に漏れないようにするためのシールド）
    const shieldThickness = 0.1;
    const shieldHeight = 1.5;
    
    // 右シールド（x = -1.0 面）
    const rShieldMesh = new THREE.Mesh(
      new THREE.BoxGeometry(shieldThickness, shieldHeight, this.holeSize),
      wallMaterial
    );
    rShieldMesh.position.set(-1.0 + (shieldThickness/2), -0.75, 2.5 - (this.holeSize/2));
    this.scene.add(rShieldMesh);
    const rShieldShape = new CANNON.Box(new CANNON.Vec3(shieldThickness/2, shieldHeight/2, this.holeSize/2));
    const rShieldBody = new CANNON.Body({ mass: 0, shape: rShieldShape });
    rShieldBody.position.copy(rShieldMesh.position);
    this.physicsWorld.addBody(rShieldBody);

    // 奥シールド（z = 1.0 面）
    const bShieldMesh = new THREE.Mesh(
      new THREE.BoxGeometry(this.holeSize, shieldHeight, shieldThickness),
      wallMaterial
    );
    bShieldMesh.position.set(-2.5 + (this.holeSize/2), -0.75, 1.0 - (shieldThickness/2));
    this.scene.add(bShieldMesh);
    const bShieldShape = new CANNON.Box(new CANNON.Vec3(this.holeSize/2, shieldHeight/2, shieldThickness/2));
    const bShieldBody = new CANNON.Body({ mass: 0, shape: bShieldShape });
    bShieldBody.position.copy(bShieldMesh.position);
    this.physicsWorld.addBody(bShieldBody);

    // 4. 外壁（アクリル・背面壁・天面）
    // 背面壁 (z = -2.5) - カラフルでネオンサインがあるイメージ
    const backWall = new THREE.Mesh(
      new THREE.BoxGeometry(this.machineWidth, this.machineHeight, 0.2),
      new THREE.MeshStandardMaterial({ color: 0x180d30, roughness: 0.5, metalness: 0.3 })
    );
    backWall.position.set(0, this.machineHeight / 2, -this.machineDepth / 2);
    backWall.receiveShadow = true;
    this.scene.add(backWall);

    // 背面壁の物理ボディ
    const backWallShape = new CANNON.Box(new CANNON.Vec3(this.machineWidth / 2, this.machineHeight / 2, 0.1));
    const backWallBody = new CANNON.Body({ mass: 0, shape: backWallShape });
    backWallBody.position.copy(backWall.position);
    this.physicsWorld.addBody(backWallBody);

    // 左壁 (x = -2.5) - 下半分は不透明、上半分はガラスとして、単純化のため物理壁を配置
    const leftWallShape = new CANNON.Box(new CANNON.Vec3(0.1, this.machineHeight / 2, this.machineDepth / 2));
    const leftWallBody = new CANNON.Body({ mass: 0, shape: leftWallShape });
    leftWallBody.position.set(-this.machineWidth / 2, this.machineHeight / 2, 0);
    this.physicsWorld.addBody(leftWallBody);

    // 右壁 (x = 2.5)
    const rightWallBody = new CANNON.Body({ mass: 0, shape: leftWallShape });
    rightWallBody.position.set(this.machineWidth / 2, this.machineHeight / 2, 0);
    this.physicsWorld.addBody(rightWallBody);

    // 前壁 (z = 2.5)
    const frontWallShape = new CANNON.Box(new CANNON.Vec3(this.machineWidth / 2, this.machineHeight / 2, 0.1));
    const frontWallBody = new CANNON.Body({ mass: 0, shape: frontWallShape });
    frontWallBody.position.set(0, this.machineHeight / 2, this.machineDepth / 2);
    this.physicsWorld.addBody(frontWallBody);

    // 天面（天井）
    const roofBody = new CANNON.Body({
      mass: 0,
      shape: new CANNON.Box(new CANNON.Vec3(this.machineWidth / 2, 0.1, this.machineDepth / 2))
    });
    roofBody.position.set(0, this.machineHeight, 0);
    this.physicsWorld.addBody(roofBody);

    // ガラス壁のビジュアル表現（Three.jsのみ、枠も作る）
    const frameGeo = new THREE.BoxGeometry(0.15, this.machineHeight, 0.15);
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x3d276b, metalness: 0.8, roughness: 0.2 });
    
    // 4本の柱
    const pillars = [
      [-this.machineWidth/2, this.machineDepth/2],
      [this.machineWidth/2, this.machineDepth/2],
      [-this.machineWidth/2, -this.machineDepth/2],
      [this.machineWidth/2, -this.machineDepth/2]
    ];
    pillars.forEach(([px, pz]) => {
      const pillar = new THREE.Mesh(frameGeo, frameMat);
      pillar.position.set(px, this.machineHeight / 2, pz);
      pillar.castShadow = true;
      this.scene.add(pillar);
    });

    // ガラス板（手前、左、右）
    const frontGlass = new THREE.Mesh(
      new THREE.PlaneGeometry(this.machineWidth - 0.1, this.machineHeight - 0.4),
      glassMaterial
    );
    frontGlass.position.set(0, this.machineHeight / 2 + 0.2, this.machineDepth / 2 - 0.05);
    this.scene.add(frontGlass);

    const leftGlass = new THREE.Mesh(
      new THREE.PlaneGeometry(this.machineDepth - 0.1, this.machineHeight - 0.4),
      glassMaterial
    );
    leftGlass.rotation.y = Math.PI / 2;
    leftGlass.position.set(-this.machineWidth / 2 + 0.05, this.machineHeight / 2 + 0.2, 0);
    this.scene.add(leftGlass);

    const rightGlass = leftGlass.clone();
    rightGlass.position.x = this.machineWidth / 2 - 0.05;
    this.scene.add(rightGlass);

    // 5. カラフルな装飾（筐体上のネオン管など）
    const neonTop = new THREE.Mesh(
      new THREE.BoxGeometry(this.machineWidth + 0.2, 0.4, this.machineDepth + 0.2),
      new THREE.MeshStandardMaterial({ color: 0x110729, roughness: 0.5 })
    );
    neonTop.position.set(0, this.machineHeight, 0);
    this.scene.add(neonTop);

    // ネオンライン（ビジュアルエフェクト用）
    const neonLineGeo = new THREE.BoxGeometry(this.machineWidth, 0.08, 0.08);
    const neonLinePink = new THREE.Mesh(neonLineGeo, neonPinkMaterial);
    neonLinePink.position.set(0, this.machineHeight - 0.2, this.machineDepth/2 + 0.08);
    this.scene.add(neonLinePink);

    const neonLineCyan = new THREE.Mesh(neonLineGeo, neonCyanMaterial);
    neonLineCyan.rotation.y = Math.PI / 2;
    neonLineCyan.position.set(-this.machineWidth/2 - 0.08, this.machineHeight - 0.2, 0);
    this.scene.add(neonLineCyan);
    
    // ネオン看板（CLAW CRUSH）をゲーム内にも配置
    // (簡易的にカラフルなパネルを作成)
    const signBoard = new THREE.Mesh(
      new THREE.BoxGeometry(3, 0.8, 0.1),
      new THREE.MeshStandardMaterial({ color: 0xff007f, emissive: 0xff007f, emissiveIntensity: 0.5 })
    );
    signBoard.position.set(0, this.machineHeight + 0.5, this.machineDepth/2 - 0.2);
    this.scene.add(signBoard);
  }

  // 物理ボディとThree.jsメッシュを紐付けて同期リストへ追加
  addBody(mesh, body) {
    this.scene.add(mesh);
    this.physicsWorld.addBody(body);
    this.syncObjects.push({ mesh, body });
  }

  // 同期リストから削除、およびシーン・物理世界から削除
  removeBody(mesh, body) {
    this.scene.remove(mesh);
    this.physicsWorld.removeBody(body);
    
    // メモリ解放
    if (mesh.geometry) mesh.geometry.dispose();
    if (Array.isArray(mesh.material)) {
      mesh.material.forEach(m => m.dispose());
    } else if (mesh.material) {
      mesh.material.dispose();
    }

    const index = this.syncObjects.findIndex(obj => obj.mesh === mesh && obj.body === body);
    if (index !== -1) {
      this.syncObjects.splice(index, 1);
    }
  }

  // 物理演算のステップを進め、Three.jsモデルと同期する
  step(dt) {
    // 固定時間ステップ（1/60秒）でサブステップを実行し、シミュレーションを安定化
    this.physicsWorld.step(1 / 60, dt, 10);

    // 描画と物理の位置・回転を同期
    for (let i = 0; i < this.syncObjects.length; i++) {
      const { mesh, body } = this.syncObjects[i];
      mesh.position.copy(body.position);
      mesh.quaternion.copy(body.quaternion);
    }

    // カメラコントロール更新
    this.controls.update();
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }

  onWindowResize() {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }
}
