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
    
    // 穴（落とし口）の設定: 左手前コーナー
    this.holeSize = 1.65;
    
    this.initThree();
    this.initPhysics();
    this.createEnvironment();
  }

  initThree() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0f081d);
    this.scene.fog = new THREE.FogExp2(0x0f081d, 0.03);

    this.camera = new THREE.PerspectiveCamera(
      45,
      this.container.clientWidth / this.container.clientHeight,
      0.1,
      100
    );
    this.camera.position.set(0, 4.8, 8.2);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.container.appendChild(this.renderer.domElement);

    this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.minDistance = 4;
    this.controls.maxDistance = 12;
    this.controls.minPolarAngle = Math.PI / 6;
    this.controls.maxPolarAngle = Math.PI / 2.1;
    this.controls.minAzimuthAngle = -Math.PI / 3;
    this.controls.maxAzimuthAngle = Math.PI / 3;
    this.controls.target.set(0, 1.8, 0);
    this.controls.update();

    // ライト設定
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.55);
    this.scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.85);
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

    const spotLight1 = new THREE.SpotLight(0xff007f, 4, 15, Math.PI / 3, 0.5, 1);
    spotLight1.position.set(-3, 6, 3);
    this.scene.add(spotLight1);

    const spotLight2 = new THREE.SpotLight(0x00f0ff, 4, 15, Math.PI / 3, 0.5, 1);
    spotLight2.position.set(3, 6, 3);
    this.scene.add(spotLight2);

    window.addEventListener('resize', () => this.onWindowResize());
  }

  initPhysics() {
    this.physicsWorld = new CANNON.World();
    this.physicsWorld.gravity.set(0, -9.82, 0);
    this.physicsWorld.broadphase = new CANNON.NaiveBroadphase();
    this.physicsWorld.solver.iterations = 20;

    // マテリアルの定義
    this.floorMat = new CANNON.Material('floor');
    this.plushMat = new CANNON.Material('plush');
    this.clawMat = new CANNON.Material('claw');

    // ぬいぐるみ同士の接触（柔らかく弾まない、適度な摩擦）
    const plushPlushContact = new CANNON.ContactMaterial(this.plushMat, this.plushMat, {
      friction: 0.6,
      restitution: 0.0,
      contactEquationStiffness: 5e4, // 少し沈み込む柔らかさ
      contactEquationRelaxation: 4
    });

    // ぬいぐるみと床の接触
    const plushFloorContact = new CANNON.ContactMaterial(this.plushMat, this.floorMat, {
      friction: 0.5,
      restitution: 0.0,
      contactEquationStiffness: 1e6,
      contactEquationRelaxation: 4
    });

    // ぬいぐるみとツメの接触（摩擦を大幅に高め、ツメからすり抜けにくいしっかりした剛性にする）
    const plushClawContact = new CANNON.ContactMaterial(this.plushMat, this.clawMat, {
      friction: 3.5,
      restitution: 0.0,
      contactEquationStiffness: 5e6,
      contactEquationRelaxation: 3,
      frictionEquationStiffness: 5e7
    });

    this.physicsWorld.addContactMaterial(plushPlushContact);
    this.physicsWorld.addContactMaterial(plushFloorContact);
    this.physicsWorld.addContactMaterial(plushClawContact);
  }

  createEnvironment() {
    const wallMaterial = new THREE.MeshStandardMaterial({
      color: 0x1e153a,
      roughness: 0.7,
      metalness: 0.2
    });
    
    const glassMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.18,
      roughness: 0.1,
      metalness: 0.1,
      depthWrite: false
    });

    const neonPinkMaterial = new THREE.MeshBasicMaterial({ color: 0xff007f });
    const neonCyanMaterial = new THREE.MeshBasicMaterial({ color: 0x00f0ff });

    const floor1Thickness = 0.4;
    
    // 床1 (右側)
    const f1Width = 5.0 - this.holeSize;
    const f1Depth = 5.0;
    const floor1Mesh = new THREE.Mesh(
      new THREE.BoxGeometry(f1Width, floor1Thickness, f1Depth),
      wallMaterial
    );
    floor1Mesh.position.set((this.machineWidth / 2) - (f1Width / 2), 0, 0);
    floor1Mesh.receiveShadow = true;
    this.scene.add(floor1Mesh);

    const floor1Shape = new CANNON.Box(new CANNON.Vec3(f1Width / 2, floor1Thickness / 2, f1Depth / 2));
    const floor1Body = new CANNON.Body({ mass: 0, material: this.floorMat, shape: floor1Shape });
    floor1Body.position.copy(floor1Mesh.position);
    this.physicsWorld.addBody(floor1Body);

    // 床2 (左奥)
    const f2Width = this.holeSize;
    const f2Depth = 5.0 - this.holeSize;
    const floor2Mesh = new THREE.Mesh(
      new THREE.BoxGeometry(f2Width, floor1Thickness, f2Depth),
      wallMaterial
    );
    floor2Mesh.position.set(-(this.machineWidth / 2) + (f2Width / 2), 0, -(this.machineDepth / 2) + (f2Depth / 2));
    floor2Mesh.receiveShadow = true;
    this.scene.add(floor2Mesh);

    const floor2Shape = new CANNON.Box(new CANNON.Vec3(f2Width / 2, floor1Thickness / 2, f2Depth / 2));
    const floor2Body = new CANNON.Body({ mass: 0, material: this.floorMat, shape: floor2Shape });
    floor2Body.position.copy(floor2Mesh.position);
    this.physicsWorld.addBody(floor2Body);

    // 落とし口のガイド境界線（少し高さのあるアクリル板・シールドにして引っかかりや転がり落ちをリアルにする）
    const borderMat = new THREE.MeshBasicMaterial({ color: 0xffcc00 });
    const borderThickness = 0.08;
    const holeBorderX = -this.machineWidth / 2 + this.holeSize;
    const holeBorderZ = this.machineDepth / 2 - this.holeSize;
    
    // 右側の境界線
    const rBorder = new THREE.Mesh(
      new THREE.BoxGeometry(borderThickness, 0.15, this.holeSize),
      borderMat
    );
    rBorder.position.set(holeBorderX, 0.25, this.machineDepth / 2 - this.holeSize / 2);
    this.scene.add(rBorder);

    // 奥側の境界線
    const bBorder = new THREE.Mesh(
      new THREE.BoxGeometry(this.holeSize, 0.15, borderThickness),
      borderMat
    );
    bBorder.position.set(-this.machineWidth / 2 + this.holeSize / 2, 0.25, holeBorderZ);
    this.scene.add(bBorder);

    // 落とし口の底（景品受け口）
    const catchFloorMesh = new THREE.Mesh(
      new THREE.BoxGeometry(this.holeSize, 0.2, this.holeSize),
      new THREE.MeshStandardMaterial({ color: 0x090514, roughness: 0.9 })
    );
    catchFloorMesh.position.set(
      -(this.machineWidth / 2) + (this.holeSize / 2),
      -1.8,
      (this.machineDepth / 2) - (this.holeSize / 2)
    );
    this.scene.add(catchFloorMesh);

    const catchFloorShape = new CANNON.Box(new CANNON.Vec3(this.holeSize / 2, 0.1, this.holeSize / 2));
    const catchFloorBody = new CANNON.Body({ mass: 0, material: this.floorMat, shape: catchFloorShape });
    catchFloorBody.position.copy(catchFloorMesh.position);
    this.physicsWorld.addBody(catchFloorBody);

    // 受け口の側壁（穴の内側に出っ張らないように床の断面より外側に配置し、引っかかりを完全に防ぐ）
    const shieldThickness = 0.1;
    const shieldHeight = 1.6;
    
    const rShieldMesh = new THREE.Mesh(
      new THREE.BoxGeometry(shieldThickness, shieldHeight, this.holeSize),
      wallMaterial
    );
    rShieldMesh.position.set(holeBorderX + (shieldThickness / 2), -1.0, 2.5 - (this.holeSize / 2));
    this.scene.add(rShieldMesh);
    const rShieldShape = new CANNON.Box(new CANNON.Vec3(shieldThickness / 2, shieldHeight / 2, this.holeSize / 2));
    const rShieldBody = new CANNON.Body({ mass: 0, material: this.floorMat, shape: rShieldShape });
    rShieldBody.position.copy(rShieldMesh.position);
    this.physicsWorld.addBody(rShieldBody);

    const bShieldMesh = new THREE.Mesh(
      new THREE.BoxGeometry(this.holeSize, shieldHeight, shieldThickness),
      wallMaterial
    );
    bShieldMesh.position.set(-2.5 + (this.holeSize / 2), -1.0, holeBorderZ - (shieldThickness / 2));
    this.scene.add(bShieldMesh);
    const bShieldShape = new CANNON.Box(new CANNON.Vec3(this.holeSize / 2, shieldHeight / 2, shieldThickness / 2));
    const bShieldBody = new CANNON.Body({ mass: 0, material: this.floorMat, shape: bShieldShape });
    bShieldBody.position.copy(bShieldMesh.position);
    this.physicsWorld.addBody(bShieldBody);

    // 外壁
    const backWall = new THREE.Mesh(
      new THREE.BoxGeometry(this.machineWidth, this.machineHeight, 0.2),
      new THREE.MeshStandardMaterial({ color: 0x180d30, roughness: 0.5, metalness: 0.3 })
    );
    backWall.position.set(0, this.machineHeight / 2, -this.machineDepth / 2);
    backWall.receiveShadow = true;
    this.scene.add(backWall);

    const backWallShape = new CANNON.Box(new CANNON.Vec3(this.machineWidth / 2, this.machineHeight / 2, 0.1));
    const backWallBody = new CANNON.Body({ mass: 0, material: this.floorMat, shape: backWallShape });
    backWallBody.position.copy(backWall.position);
    this.physicsWorld.addBody(backWallBody);

    const leftWallShape = new CANNON.Box(new CANNON.Vec3(0.1, this.machineHeight / 2, this.machineDepth / 2));
    const leftWallBody = new CANNON.Body({ mass: 0, material: this.floorMat, shape: leftWallShape });
    leftWallBody.position.set(-this.machineWidth / 2, this.machineHeight / 2, 0);
    this.physicsWorld.addBody(leftWallBody);

    const rightWallBody = new CANNON.Body({ mass: 0, material: this.floorMat, shape: leftWallShape });
    rightWallBody.position.set(this.machineWidth / 2, this.machineHeight / 2, 0);
    this.physicsWorld.addBody(rightWallBody);

    const frontWallShape = new CANNON.Box(new CANNON.Vec3(this.machineWidth / 2, this.machineHeight / 2, 0.1));
    const frontWallBody = new CANNON.Body({ mass: 0, material: this.floorMat, shape: frontWallShape });
    frontWallBody.position.set(0, this.machineHeight / 2, this.machineDepth / 2);
    this.physicsWorld.addBody(frontWallBody);

    const roofBody = new CANNON.Body({
      mass: 0,
      material: this.floorMat,
      shape: new CANNON.Box(new CANNON.Vec3(this.machineWidth / 2, 0.1, this.machineDepth / 2))
    });
    roofBody.position.set(0, this.machineHeight, 0);
    this.physicsWorld.addBody(roofBody);

    // 4本の柱とガラス
    const frameGeo = new THREE.BoxGeometry(0.15, this.machineHeight, 0.15);
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x3d276b, metalness: 0.8, roughness: 0.2 });
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

    const neonTop = new THREE.Mesh(
      new THREE.BoxGeometry(this.machineWidth + 0.2, 0.4, this.machineDepth + 0.2),
      new THREE.MeshStandardMaterial({ color: 0x110729, roughness: 0.5 })
    );
    neonTop.position.set(0, this.machineHeight, 0);
    this.scene.add(neonTop);

    const neonLineGeo = new THREE.BoxGeometry(this.machineWidth, 0.08, 0.08);
    const neonLinePink = new THREE.Mesh(neonLineGeo, neonPinkMaterial);
    neonLinePink.position.set(0, this.machineHeight - 0.2, this.machineDepth/2 + 0.08);
    this.scene.add(neonLinePink);

    const neonLineCyan = new THREE.Mesh(neonLineGeo, neonCyanMaterial);
    neonLineCyan.rotation.y = Math.PI / 2;
    neonLineCyan.position.set(-this.machineWidth/2 - 0.08, this.machineHeight - 0.2, 0);
    this.scene.add(neonLineCyan);
    
    const signBoard = new THREE.Mesh(
      new THREE.BoxGeometry(3, 0.8, 0.1),
      new THREE.MeshStandardMaterial({ color: 0xff007f, emissive: 0xff007f, emissiveIntensity: 0.5 })
    );
    signBoard.position.set(0, this.machineHeight + 0.5, this.machineDepth/2 - 0.2);
    this.scene.add(signBoard);
  }

  addBody(mesh, body) {
    this.scene.add(mesh);
    this.physicsWorld.addBody(body);
    this.syncObjects.push({ mesh, body });
  }

  removeBody(mesh, body) {
    if (mesh) this.scene.remove(mesh);
    if (body) this.physicsWorld.removeBody(body);
    
    if (mesh) {
      mesh.traverse((child) => {
        if (child.isMesh) {
          if (child.geometry) child.geometry.dispose();
          if (Array.isArray(child.material)) {
            child.material.forEach(m => m.dispose());
          } else if (child.material) {
            child.material.dispose();
          }
        }
      });
    }

    const index = this.syncObjects.findIndex(obj => obj.mesh === mesh && obj.body === body);
    if (index !== -1) {
      this.syncObjects.splice(index, 1);
    }
  }

  step(dt) {
    this.physicsWorld.step(1 / 60, dt, 10);

    for (let i = 0; i < this.syncObjects.length; i++) {
      const { mesh, body } = this.syncObjects[i];
      if (mesh && body) {
        mesh.position.copy(body.position);
        mesh.quaternion.copy(body.quaternion);
      }
    }

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
