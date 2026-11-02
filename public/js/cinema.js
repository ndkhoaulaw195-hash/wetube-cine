/**
 * wetube ciné mini - 3D Cinema Theater Engine (Three.js + CSS3D)
 * Built for 10-person VIP cinema hall with real users
 */

class CinemaScene {
  constructor(containerId, cssContainerId, startPaused = false) {
    this.container = document.getElementById(containerId);
    this.cssContainer = document.getElementById(cssContainerId);

    this.scene = null;
    this.cssScene = null;
    this.camera = null;
    this.renderer = null;
    this.cssRenderer = null;
    this.cssScreenObject = null;
    this.hasWebGL = false;
    this.isPaused = !!startPaused;
    this.animationFrameId = null;
    this.lastHoverCheck = 0;
    this.wasPausedByTab = false;

    // Adaptive FPS State (60 FPS on movement/events, 24 FPS when idle watching movie)
    this.lastRenderTime = 0;
    this.lastActiveTime = performance.now();
    this.currentMySeatId = null;

    // Quality setting: 'high' | 'smooth'
    this.quality = 'smooth';
    this.partyMode = false;
    this.lightsOff = false;

    // Camera state & targets for smooth interpolation (lerp)
    this.cameraMode = 'overview'; // 'overview' | 'seat' | 'screen' | 'audience'
    this.camTargetPos = new THREE.Vector3(0, 6.3, 9.8);
    this.camTargetLook = new THREE.Vector3(0, 3.8, -5.8);
    this.camCurrentLook = new THREE.Vector3(0, 3.8, -5.8);
    this.isDollyActive = false;

    // Mouse drag orbit offsets
    this.mouseOffsetX = 0;
    this.mouseOffsetY = 0;
    this.targetMouseX = 0;
    this.targetMouseY = 0;
    this.isDragging = false;
    this.lastMousePos = { x: 0, y: 0 };

    // 10 Seats Coordinates
    // Row A: 5 front seats (y = 0.35, z = -2.2)
    // Row B: 5 back seats on elevated step (y = 1.0, z = 1.1)
    this.seatCoords = [
      { id: 0, label: 'A01', x: -4.8, y: 0.35, z: -2.2 },
      { id: 1, label: 'A02', x: -2.4, y: 0.35, z: -2.2 },
      { id: 2, label: 'A03', x: 0.0,  y: 0.35, z: -2.2 },
      { id: 3, label: 'A04', x: 2.4,  y: 0.35, z: -2.2 },
      { id: 4, label: 'A05', x: 4.8,  y: 0.35, z: -2.2 },
      { id: 5, label: 'B01', x: -4.8, y: 1.0,  z: 1.1 },
      { id: 6, label: 'B02', x: -2.4, y: 1.0,  z: 1.1 },
      { id: 7, label: 'B03', x: 0.0,  y: 1.0,  z: 1.1 },
      { id: 8, label: 'B04', x: 2.4,  y: 1.0,  z: 1.1 },
      { id: 9, label: 'B05', x: 4.8,  y: 1.0,  z: 1.1 }
    ];

    // Meshes references
    this.seatMeshes = [];      // 10 seats
    this.avatarMeshes = [];    // 10 seated avatars
    this.stageAvatar = null;   // Avatar on stage
    this.discoBallGroup = null;
    this.spotlights = [];
    this.laserBeams = [];
    this.floatingParticles = [];

    // Raycasting for interactive seat clicking
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.hoveredSeat = null;

    // Callbacks
    this.onSeatClick = null;

    this.clock = new THREE.Clock();
    this.init();
  }

  init() {
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;

    // 1. WebGL Scene & Camera
    this.scene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(54, width / height, 0.1, 100);
    this.camera.position.set(0, 6.3, 9.8);
    this.camera.lookAt(this.camCurrentLook);

    // 2. Optimized Ultra-Smooth WebGL Renderer
    try {
      this.renderer = new THREE.WebGLRenderer({
        antialias: false,
        alpha: false,
        powerPreference: 'high-performance',
        precision: 'mediump',
        stencil: false
      });
      this.renderer.setSize(width, height);
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25));
      this.renderer.shadowMap.enabled = false;
      this.container.appendChild(this.renderer.domElement);
      this.hasWebGL = true;
    } catch (e1) {
      try {
        this.renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false });
        this.renderer.setSize(width, height);
        this.renderer.setPixelRatio(1);
        this.container.appendChild(this.renderer.domElement);
        this.hasWebGL = true;
      } catch (e2) {
        console.warn('WebGL không khả dụng, chuyển sang chế độ phẳng:', e2);
        this.hasWebGL = false;
      }
    }

    // 3. CSS3D Renderer (For embedding synced YouTube screen in 3D space)
    if (typeof THREE.CSS3DRenderer !== 'undefined') {
      this.cssScene = new THREE.Scene();
      this.cssRenderer = new THREE.CSS3DRenderer();
      this.cssRenderer.setSize(width, height);
      this.cssRenderer.domElement.style.position = 'absolute';
      this.cssRenderer.domElement.style.top = '0';
      this.cssRenderer.domElement.style.left = '0';
      this.cssRenderer.domElement.style.width = '100%';
      this.cssRenderer.domElement.style.height = '100%';
      this.cssRenderer.domElement.style.pointerEvents = 'none';
      this.cssContainer.appendChild(this.cssRenderer.domElement);
    }

    if (this.hasWebGL) {
      this.buildTheaterEnvironment();
      this.buildSeats();
      this.buildDiscoBallAndLights();
    }

    this.buildScreenAndCSS3D();

    // Event Listeners
    window.addEventListener('resize', () => this.onWindowResize(), { passive: true });
    this.container.addEventListener('pointerdown', (e) => this.onPointerDown(e), { passive: true });
    this.container.addEventListener('pointermove', (e) => this.onPointerMove(e), { passive: true });
    this.container.addEventListener('pointerup', (e) => this.onPointerUp(e), { passive: true });
    this.container.addEventListener('click', (e) => this.onClick(e));

    // Pause when tab is hidden to save 100% background CPU
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        if (!this.isPaused) {
          this.wasPausedByTab = true;
          this.pause();
        }
      } else if (this.wasPausedByTab) {
        this.wasPausedByTab = false;
        this.resume();
      }
    });

    // Animation Loop
    if (!this.isPaused) {
      this.animate();
    }
  }

  buildTheaterEnvironment() {
    const hallWidth = 21;
    const hallLength = 26;
    const hallHeight = 12.2;

    this.floorMat = new THREE.MeshStandardMaterial({
      color: 0x161816,
      roughness: 0.85,
      metalness: 0.1
    });

    this.wallMat = new THREE.MeshStandardMaterial({
      color: 0x111311,
      roughness: 0.9,
      metalness: 0.15
    });

    const woodStageMat = new THREE.MeshStandardMaterial({
      color: 0x241d17,
      roughness: 0.45,
      metalness: 0.2
    });

    this.goldTrimMat = new THREE.MeshStandardMaterial({
      color: 0xf2cf78,
      roughness: 0.3,
      metalness: 0.8,
      emissive: 0x705218,
      emissiveIntensity: 0.22
    });

    // 1. Tiered Cinema Floor
    // Front level: y = 0
    const frontFloorGeo = new THREE.BoxGeometry(hallWidth, 0.4, 10);
    const frontFloor = new THREE.Mesh(frontFloorGeo, this.floorMat);
    frontFloor.position.set(0, -0.2, -3.5);
    frontFloor.receiveShadow = true;
    this.scene.add(frontFloor);

    // Back Tier (Elevated step for Row B): y = 0.65
    const backFloorGeo = new THREE.BoxGeometry(hallWidth, 1.0, 12);
    const backFloor = new THREE.Mesh(backFloorGeo, this.floorMat);
    backFloor.position.set(0, 0.1, 6.2);
    backFloor.receiveShadow = true;
    this.scene.add(backFloor);

    // Glowing step strip
    const stepStripGeo = new THREE.BoxGeometry(hallWidth, 0.06, 0.08);
    this.stepStripMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b });
    const stepStrip = new THREE.Mesh(stepStripGeo, this.stepStripMat);
    stepStrip.position.set(0, 0.62, 0.22);
    this.scene.add(stepStrip);

    // 2. Front Stage Platform in front of screen (low profile so stage dancers never cover screen)
    const stageGeo = new THREE.BoxGeometry(15.2, 0.36, 3.6);
    const stage = new THREE.Mesh(stageGeo, woodStageMat);
    stage.position.set(0, 0.12, -6.2);
    stage.receiveShadow = true;
    this.scene.add(stage);

    // Stage Front Edge Neon Gold Accent
    const stageEdgeGeo = new THREE.BoxGeometry(15.25, 0.06, 0.07);
    this.stageEdgeMat = new THREE.MeshBasicMaterial({ color: 0xf2cf78 });
    const stageEdge = new THREE.Mesh(stageEdgeGeo, this.stageEdgeMat);
    stageEdge.position.set(0, 0.31, -4.4);
    this.scene.add(stageEdge);

    // 3. Walls & Ceiling
    const backWallGeo = new THREE.BoxGeometry(hallWidth + 2, hallHeight, 0.5);
    const backWall = new THREE.Mesh(backWallGeo, this.wallMat);
    backWall.position.set(0, hallHeight / 2 - 0.2, -10.5);
    backWall.receiveShadow = true;
    this.scene.add(backWall);

    const rearWall = new THREE.Mesh(backWallGeo, this.wallMat);
    rearWall.position.set(0, hallHeight / 2 - 0.2, 13.5);
    this.scene.add(rearWall);

    const sideWallGeo = new THREE.BoxGeometry(0.5, hallHeight, hallLength);
    const leftWall = new THREE.Mesh(sideWallGeo, this.wallMat);
    leftWall.position.set(-hallWidth / 2, hallHeight / 2 - 0.2, 0);
    this.scene.add(leftWall);

    const rightWall = new THREE.Mesh(sideWallGeo, this.wallMat);
    rightWall.position.set(hallWidth / 2, hallHeight / 2 - 0.2, 0);
    this.scene.add(rightWall);

    // Decorative wall ribs
    for (let z = -7; z <= 10; z += 3.5) {
      const ribGeo = new THREE.BoxGeometry(0.2, hallHeight - 2, 1.2);
      const ribLeft = new THREE.Mesh(ribGeo, this.goldTrimMat);
      ribLeft.position.set(-hallWidth / 2 + 0.25, hallHeight / 2, z);
      this.scene.add(ribLeft);

      const ribRight = new THREE.Mesh(ribGeo, this.goldTrimMat);
      ribRight.position.set(hallWidth / 2 - 0.25, hallHeight / 2, z);
      this.scene.add(ribRight);
    }

    const ceilingGeo = new THREE.BoxGeometry(hallWidth + 2, 0.4, hallLength);
    const ceiling = new THREE.Mesh(ceilingGeo, this.wallMat);
    ceiling.position.set(0, hallHeight, 0);
    this.scene.add(ceiling);

    // Speaker Towers (Placed wide outside the 13.6-wide screen so they never overlap the screen frame)
    const speakerGeo = new THREE.BoxGeometry(1.1, 3.2, 1.1);
    const speakerMat = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.5 });
    const speakerL = new THREE.Mesh(speakerGeo, speakerMat);
    speakerL.position.set(-8.2, 1.8, -8.3);
    this.scene.add(speakerL);

    const speakerR = new THREE.Mesh(speakerGeo, speakerMat);
    speakerR.position.set(8.2, 1.8, -8.3);
    this.scene.add(speakerR);

    // Lighting
    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.46);
    this.scene.add(this.ambientLight);

    this.warmKeyLight = new THREE.DirectionalLight(0xfff1d6, 0.65);
    this.warmKeyLight.position.set(0, 10, 5);
    this.scene.add(this.warmKeyLight);
  }

  buildScreenAndCSS3D() {
    const screenWidth = 13.6;
    const screenHeight = 7.65;

    // In WebGL, add the outer frame bezel behind the screen
    if (this.hasWebGL) {
      const frameGeo = new THREE.BoxGeometry(screenWidth + 0.7, screenHeight + 0.55, 0.3);
      const frameMat = new THREE.MeshStandardMaterial({ color: 0x070807, roughness: 0.7 });
      const screenFrame = new THREE.Mesh(frameGeo, frameMat);
      screenFrame.position.set(0, 5.65, -9.85);
      this.scene.add(screenFrame);

      // Glowing Neon Brand Text beneath screen: "✦ W E T U B E   C I N É   M I N I ✦"
      const signCanvas = document.createElement('canvas');
      signCanvas.width = 1024;
      signCanvas.height = 128;
      const ctx = signCanvas.getContext('2d');
      ctx.fillStyle = '#060706';
      ctx.fillRect(0, 0, signCanvas.width, signCanvas.height);
      ctx.font = 'bold 42px "Plus Jakarta Sans", sans-serif';
      ctx.fillStyle = '#f2cf78';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = '#f2cf78';
      ctx.shadowBlur = 22;
      ctx.fillText('✦ W E T U B E   C I N É   M I N I ✦', 512, 64);

      const signTex = new THREE.CanvasTexture(signCanvas);
      const signGeo = new THREE.PlaneGeometry(5.2, 0.56);
      const signMat = new THREE.MeshBasicMaterial({ map: signTex, transparent: true });
      const signMesh = new THREE.Mesh(signGeo, signMat);
      signMesh.position.set(0, 1.38, -9.45);
      this.scene.add(signMesh);

      // Warm Glow behind the screen
      this.screenBackLight = new THREE.PointLight(0xf2cf78, 1.4, 15);
      this.screenBackLight.position.set(0, 5.65, -9.2);
      this.scene.add(this.screenBackLight);
    }

    // Attach CSS3DObject (YouTube Player DOM element)
    const screenElement = document.getElementById('screen-surface');
    if (screenElement && typeof THREE.CSS3DObject !== 'undefined' && this.cssScene) {
      this.cssScreenObject = new THREE.CSS3DObject(screenElement);
      this.cssScreenObject.position.set(0, 5.65, -9.6);
      const scaleFactor = screenWidth / 1280;
      this.cssScreenObject.scale.set(scaleFactor, scaleFactor, scaleFactor);
      this.cssScene.add(this.cssScreenObject);
    }
  }

  buildSeats() {
    const leatherRed = new THREE.MeshStandardMaterial({
      color: 0x7a1e28, // Luxurious dark red velvet / leather
      roughness: 0.65,
      metalness: 0.15
    });

    const darkArmMat = new THREE.MeshStandardMaterial({
      color: 0x222422,
      roughness: 0.7,
      metalness: 0.3
    });

    const baseMat = new THREE.MeshStandardMaterial({
      color: 0x151615,
      roughness: 0.8,
      metalness: 0.5
    });

    this.seatCoords.forEach((coord) => {
      const seatGroup = new THREE.Group();
      seatGroup.position.set(coord.x, coord.y, coord.z);

      // Seat Base
      const baseGeo = new THREE.BoxGeometry(1.3, 0.2, 1.1);
      const base = new THREE.Mesh(baseGeo, baseMat);
      base.position.set(0, 0.1, 0);
      seatGroup.add(base);

      // Cushion
      const cushionGeo = new THREE.BoxGeometry(1.2, 0.35, 1.05);
      const cushion = new THREE.Mesh(cushionGeo, leatherRed);
      cushion.position.set(0, 0.35, -0.05);
      seatGroup.add(cushion);

      // Backrest
      const backGeo = new THREE.BoxGeometry(1.2, 1.25, 0.28);
      const backrest = new THREE.Mesh(backGeo, leatherRed);
      backrest.position.set(0, 1.05, 0.44);
      backrest.rotation.x = -0.12;
      seatGroup.add(backrest);

      // Headrest Pillow
      const headGeo = new THREE.BoxGeometry(0.85, 0.32, 0.18);
      const headrest = new THREE.Mesh(headGeo, leatherRed);
      headrest.position.set(0, 1.62, 0.48);
      seatGroup.add(headrest);

      // Armrests
      for (const side of [-0.68, 0.68]) {
        const armGeo = new THREE.BoxGeometry(0.22, 0.6, 1.05);
        const arm = new THREE.Mesh(armGeo, darkArmMat);
        arm.position.set(side, 0.6, 0);
        seatGroup.add(arm);

        const cupGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.08, 12);
        const cup = new THREE.Mesh(cupGeo, baseMat);
        cup.position.set(side, 0.91, -0.35);
        seatGroup.add(cup);
      }

      // Seat Number Label Plate ("A01", "B03"...)
      const labelCanvas = document.createElement('canvas');
      labelCanvas.width = 128;
      labelCanvas.height = 64;
      const lCtx = labelCanvas.getContext('2d');
      lCtx.fillStyle = '#222522';
      lCtx.fillRect(0, 0, 128, 64);
      lCtx.strokeStyle = '#f2cf78';
      lCtx.lineWidth = 4;
      lCtx.strokeRect(2, 2, 124, 60);
      lCtx.font = 'bold 34px "JetBrains Mono", monospace';
      lCtx.fillStyle = '#f2cf78';
      lCtx.textAlign = 'center';
      lCtx.textBaseline = 'middle';
      lCtx.fillText(coord.label, 64, 34);

      const labelTex = new THREE.CanvasTexture(labelCanvas);
      const labelGeo = new THREE.PlaneGeometry(0.38, 0.18);
      const labelMat = new THREE.MeshBasicMaterial({ map: labelTex });
      const labelMesh = new THREE.Mesh(labelGeo, labelMat);
      labelMesh.position.set(0, 1.48, 0.59);
      seatGroup.add(labelMesh);

      seatGroup.userData = { seatId: coord.id, label: coord.label, coord };
      cushion.userData = { seatId: coord.id, parentGroup: seatGroup };
      backrest.userData = { seatId: coord.id, parentGroup: seatGroup };

      this.scene.add(seatGroup);
      this.seatMeshes[coord.id] = seatGroup;
      this.avatarMeshes[coord.id] = null;
    });
  }

  buildDiscoBallAndLights() {
    this.discoBallGroup = new THREE.Group();
    this.discoBallGroup.position.set(0, 10.8, -3.0);

    const rodGeo = new THREE.CylinderGeometry(0.02, 0.02, 1.2, 8);
    const rodMat = new THREE.MeshStandardMaterial({ color: 0x444444, metalness: 0.9, roughness: 0.2 });
    const rod = new THREE.Mesh(rodGeo, rodMat);
    rod.position.set(0, 0.6, 0);
    this.discoBallGroup.add(rod);

    const sphereGeo = new THREE.IcosahedronGeometry(0.45, 3);
    const sphereMat = new THREE.MeshStandardMaterial({
      color: 0xd4d4d8,
      metalness: 0.95,
      roughness: 0.1,
      flatShading: true
    });
    const ball = new THREE.Mesh(sphereGeo, sphereMat);
    this.discoBallGroup.add(ball);
    this.scene.add(this.discoBallGroup);

    // 4 Spotlights
    const spotColors = [0xec4899, 0x3b82f6, 0xf59e0b, 0x10b981];
    const spotOffsets = [
      { x: -5, z: -4 },
      { x: 5, z: -4 },
      { x: -5, z: 4 },
      { x: 5, z: 4 }
    ];

    spotColors.forEach((color, i) => {
      const spot = new THREE.SpotLight(color, 0, 18, Math.PI / 6, 0.4, 1.2);
      spot.position.set(spotOffsets[i].x, 9.5, spotOffsets[i].z);
      spot.target = ball;
      this.scene.add(spot);
      this.spotlights.push(spot);
    });

    // Lasers
    const laserColors = [0xef4444, 0x10b981, 0x8b5cf6, 0x06b6d4];
    for (let i = 0; i < 4; i++) {
      const laserGeo = new THREE.CylinderGeometry(0.02, 0.02, 22, 6);
      const laserMat = new THREE.MeshBasicMaterial({
        color: laserColors[i],
        transparent: true,
        opacity: 0
      });
      const laser = new THREE.Mesh(laserGeo, laserMat);
      laser.position.set((i - 1.5) * 3, 8.5, 0);
      laser.rotation.x = Math.PI / 2.3;
      this.scene.add(laser);
      this.laserBeams.push(laser);
    }
  }

  setPartyMode(active) {
    this.partyMode = !!active;
    this.applyLightingState();
  }

  setLightsOff(active) {
    this.lightsOff = !!active;
    document.body.classList.toggle('lights-off', this.lightsOff);
    this.applyLightingState();
  }

  applyLightingState() {
    if (!this.hasWebGL) return;

    // 1. Base theater room lighting (controlled by lightsOff)
    if (this.lightsOff) {
      if (this.ambientLight) this.ambientLight.intensity = this.partyMode ? 0.12 : 0.05;
      if (this.warmKeyLight) this.warmKeyLight.intensity = 0.04;
      if (this.wallMat) this.wallMat.color.setHex(0x040504);
      if (this.floorMat) this.floorMat.color.setHex(0x060706);
      if (this.screenBackLight) this.screenBackLight.intensity = 0.55;
    } else {
      if (this.ambientLight) this.ambientLight.intensity = 0.46;
      if (this.warmKeyLight) this.warmKeyLight.intensity = 0.65;
      if (this.wallMat) this.wallMat.color.setHex(0x111311);
      if (this.floorMat) this.floorMat.color.setHex(0x161816);
      if (this.screenBackLight) this.screenBackLight.intensity = 1.4;
    }

    // 2. Party disco spotlights, lasers & neon wall strips (works both when lights are ON or OFF!)
    const spotIntensity = this.partyMode ? (this.lightsOff ? 6.5 : 4.8) : 0;
    this.spotlights.forEach((spot) => {
      spot.intensity = spotIntensity;
    });

    this.laserBeams.forEach((laser) => {
      laser.material.opacity = this.partyMode ? (this.lightsOff ? 0.85 : 0.65) : 0;
    });

    if (!this.partyMode) {
      if (this.lightsOff) {
        if (this.goldTrimMat) {
          this.goldTrimMat.color.setHex(0x14120c);
          this.goldTrimMat.emissive.setHex(0x000000);
          this.goldTrimMat.emissiveIntensity = 0.0;
        }
        if (this.stepStripMat) this.stepStripMat.color.setHex(0x2e1f05);
        if (this.stageEdgeMat) this.stageEdgeMat.color.setHex(0x2e2512);
      } else {
        if (this.goldTrimMat) {
          this.goldTrimMat.color.setHex(0xf2cf78);
          this.goldTrimMat.emissive.setHex(0x705218);
          this.goldTrimMat.emissiveIntensity = 0.22;
        }
        if (this.stepStripMat) this.stepStripMat.color.setHex(0xf59e0b);
        if (this.stageEdgeMat) this.stageEdgeMat.color.setHex(0xf2cf78);
      }
    }
  }

  // Update All 10 Seats for Real Users
  updateSeats(seatsData) {
    if (!seatsData || !this.hasWebGL) return;

    for (let i = 0; i < 10; i++) {
      const occupant = seatsData[i];
      if (occupant) {
        const prevData = this.avatarMeshes[i]?.userData;
        const hasChanged = !prevData
          || prevData.userId !== occupant.userId
          || prevData.avatarId !== occupant.avatarId
          || prevData.name !== occupant.name
          || prevData.tier !== occupant.tier
          || !!prevData.micOn !== !!occupant.micOn;
        if (hasChanged) {
          this.removeAvatarFromSeat(i);
          this.createAvatarAtSeat(i, occupant);
        }
      } else {
        this.removeAvatarFromSeat(i);
      }
    }
  }

  createPixelCharacterSprite(avatarId = 'pixel_nerd', scaleY = 1.45) {
    if (window.PixelAvatars) {
      const canvas = window.PixelAvatars.createSpriteCanvas(avatarId);
      const texture = new THREE.CanvasTexture(canvas);
      texture.magFilter = THREE.NearestFilter;
      texture.minFilter = THREE.NearestFilter;
      texture.generateMipmaps = false;
      const mat = new THREE.SpriteMaterial({ map: texture, transparent: true });
      const sprite = new THREE.Sprite(mat);
      sprite.scale.set(scaleY * (24 / 30), scaleY, 1);
      return sprite;
    }
    return new THREE.Group();
  }

  createAvatarAtSeat(seatId, user) {
    const coord = this.seatCoords[seatId];
    if (!coord) return;

    const avatarGroup = new THREE.Group();
    avatarGroup.position.set(coord.x, coord.y + 0.35, coord.z + 0.08);
    avatarGroup.userData = {
      userId: user.userId || user.id,
      avatarId: user.avatarId || 'pixel_nerd',
      name: user.name,
      tier: user.tier,
      micOn: !!user.micOn
    };

    // Chibi 16-bit Pixel Art Character Sprite (seated naturally in chair)
    const charSprite = this.createPixelCharacterSprite(user.avatarId || 'pixel_nerd', 1.42);
    charSprite.position.set(0, 0.72, 0);
    avatarGroup.add(charSprite);

    // Name Tag (positioned above head)
    const displayLabel = user.micOn ? `🎙️ ${user.name}` : user.name;
    const tagColor = user.micOn ? '#10b981' : (user.color || '#f2cf78');
    const nameSprite = this.createNameTagSprite(displayLabel, user.tier, tagColor);
    nameSprite.position.set(0, 1.68, 0);
    avatarGroup.add(nameSprite);

    this.scene.add(avatarGroup);
    this.avatarMeshes[seatId] = avatarGroup;
  }

  removeAvatarFromSeat(seatId) {
    if (this.avatarMeshes[seatId]) {
      this.scene.remove(this.avatarMeshes[seatId]);
      this.avatarMeshes[seatId] = null;
    }
  }

  updateStageUser() {
    if (this.stageAvatar) {
      this.scene.remove(this.stageAvatar);
      this.stageAvatar = null;
    }
  }

  createNameTagSprite(name, tier = 'Khán Giả', color = '#f2cf78') {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 140;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = 'rgba(18, 20, 18, 0.88)';
    ctx.strokeStyle = color;
    ctx.lineWidth = 6;
    this.roundRect(ctx, 10, 10, 492, 120, 24);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 42px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(name.substring(0, 18), 256, 60);

    ctx.fillStyle = color;
    ctx.font = '600 24px "Plus Jakarta Sans", sans-serif';
    ctx.fillText(`✦ ${tier || 'Khán Giả VIP'} ✦`, 256, 104);

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    const spriteMat = new THREE.SpriteMaterial({ map: texture, depthTest: false });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.scale.set(1.45, 0.39, 1);
    return sprite;
  }

  roundRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }

  showSpeechBubble(userId, text, seatId, isOnStage) {
    if (!this.hasWebGL) return;
    let targetPos = null;
    if (isOnStage && this.stageAvatar) {
      targetPos = this.stageAvatar.position.clone().add(new THREE.Vector3(0, 2.2, 0));
    } else if (seatId !== null && this.avatarMeshes[seatId]) {
      targetPos = this.avatarMeshes[seatId].position.clone().add(new THREE.Vector3(0, 1.9, 0));
    }

    if (!targetPos) return;

    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 160;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    this.roundRect(ctx, 10, 10, 492, 120, 20);
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(240, 130);
    ctx.lineTo(256, 155);
    ctx.lineTo(272, 130);
    ctx.fill();

    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 32px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text.substring(0, 26), 256, 70);

    const texture = new THREE.CanvasTexture(canvas);
    const spriteMat = new THREE.SpriteMaterial({ map: texture, depthTest: false });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.position.copy(targetPos);
    sprite.scale.set(2.4, 0.75, 1);

    this.scene.add(sprite);

    setTimeout(() => {
      this.scene.remove(sprite);
      texture.dispose();
      spriteMat.dispose();
    }, 5000);
  }

  spawnEmojiReaction(emoji, seatId, isOnStage, isVip = false) {
    // 1. DOM floating animation overlay (luôn hiển thị rõ nét trên màn hình)
    this.spawnDomFloatingEmoji(emoji, isVip);

    // 2. 3D WebGL floating sprite (nếu có WebGL)
    if (!this.hasWebGL) return;
    let startPos = new THREE.Vector3(0, 1.8, -6.6);
    if (seatId !== null && this.seatCoords[seatId]) {
      const c = this.seatCoords[seatId];
      startPos.set(c.x + (Math.random() - 0.5) * 0.4, c.y + 1.2, c.z);
    }

    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    ctx.font = isVip ? 'bold 68px sans-serif' : '72px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (isVip) {
      ctx.shadowColor = 'rgba(245, 158, 11, 0.9)';
      ctx.shadowBlur = 16;
    }
    ctx.fillText(emoji, 64, 64);

    const texture = new THREE.CanvasTexture(canvas);
    const spriteMat = new THREE.SpriteMaterial({ map: texture, depthTest: false, transparent: true });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.position.copy(startPos);
    const scale = isVip ? 1.35 : 0.9;
    sprite.scale.set(scale, scale, 1);

    this.scene.add(sprite);

    this.floatingParticles.push({
      sprite,
      vy: 1.8 + Math.random() * 0.8,
      vx: (Math.random() - 0.5) * 0.6,
      opacity: 1.0
    });
  }

  spawnDomFloatingEmoji(emoji, isVip = false) {
    const el = document.createElement('div');
    el.className = 'dom-floating-emoji' + (isVip ? ' vip-emoji' : '');
    el.textContent = isVip ? `✨${emoji}` : emoji;
    const rightDock = 15 + Math.random() * 65;
    const bottomDock = 60 + Math.random() * 80;
    const size = isVip ? (36 + Math.floor(Math.random() * 14)) : (26 + Math.floor(Math.random() * 16));
    el.style.fontSize = `${size}px`;
    el.style.right = `${rightDock}px`;
    el.style.bottom = `${bottomDock}px`;
    document.body.appendChild(el);
    setTimeout(() => {
      el.remove();
    }, 2200);
  }

  setDataSaver(enabled) {
    this.isDataSaver = !!enabled;
    if (this.renderer) {
      this.renderer.setPixelRatio(enabled ? 1.0 : Math.min(window.devicePixelRatio, 2));
    }
  }

  setCameraMode(mode, seatId = null) {
    if (this.cameraMode === mode) return;
    const prevMode = this.cameraMode;
    this.cameraMode = mode;
    this.mouseOffsetX = 0;
    this.mouseOffsetY = 0;
    this.targetMouseX = 0;
    this.targetMouseY = 0;
    this.markActive();

    let targetPos, targetLook;
    switch (mode) {
      case 'overview':
        targetPos = new THREE.Vector3(0, 6.2, 9.5);
        targetLook = new THREE.Vector3(0, 4.0, -6.0);
        break;

      case 'screen':
        // Chế độ Màn hình: Camera tiến sát đến z = -2.1, trực diện tâm màn chiếu (y = 5.65)
        // Màn chiếu 16:9 mở rộng tràn 100% full viền toàn màn hình, không còn bị nhỏ hay góc chéo.
        targetPos = new THREE.Vector3(0, 5.65, -2.1);
        targetLook = new THREE.Vector3(0, 5.65, -9.6);
        break;

      case 'audience':
        targetPos = new THREE.Vector3(0, 2.2, -6.5);
        targetLook = new THREE.Vector3(0, 1.6, 2.0);
        break;

      default:
        targetPos = new THREE.Vector3(0, 6.2, 9.5);
        targetLook = new THREE.Vector3(0, 4.0, -6.0);
    }

    this.camTargetPos.copy(targetPos);
    this.camTargetLook.copy(targetLook);

    const isDirectionFlip = (prevMode === 'audience' || mode === 'audience');
    const vp = document.getElementById('cinema-viewport');

    if (isDirectionFlip) {
      // Khi quay giữa Khán giả <-> Màn hình / Toàn cảnh (quay ngược 180 độ):
      // Dùng hiệu ứng chuyển cảnh mềm êm dịu (Soft dissolve cut 140ms):
      this.isFlipping = true;
      this.dollyActive = false;
      if (vp) vp.classList.add('cam-switching');

      setTimeout(() => {
        this.camera.position.copy(targetPos);
        this.camCurrentLook.copy(targetLook);
        this.camera.lookAt(this.camCurrentLook);
        setTimeout(() => {
          if (vp) vp.classList.remove('cam-switching');
          this.isFlipping = false;
        }, 40);
      }, 110);
    } else {
      // Chuyển giữa Toàn cảnh <-> Màn hình: Lướt Cinematic mượt mà (Ease-in-out 720ms), êm ái tự nhiên, không khựng cứng
      this.isFlipping = false;
      this.dollyActive = true;
      this.dollyStart = performance.now();
      this.dollyDuration = 720;
      this.dollyFromPos = this.camera.position.clone();
      this.dollyFromLook = this.camCurrentLook.clone();
    }
  }

  markActive() {
    this.lastActiveTime = performance.now();
  }

  pause() {
    this.isPaused = true;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  resume() {
    if (!this.isPaused) return;
    this.isPaused = false;
    this.clock.start();
    this.animate();
  }

  setQuality(quality) {
    this.quality = quality;
    if (this.hasWebGL && this.renderer) {
      if (quality === 'smooth') {
        this.renderer.setPixelRatio(1);
        this.renderer.shadowMap.enabled = false;
      } else {
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25));
        this.renderer.shadowMap.enabled = false;
      }
    }
  }

  onPointerDown(e) {
    this.isDragging = true;
    this.lastMousePos = { x: e.clientX, y: e.clientY };
    this.markActive();
  }

  onPointerMove(e) {
    if (!this.hasWebGL || this.isPaused) return;
    const rect = this.container.getBoundingClientRect();
    this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    this.checkSeatHover();

    if (this.isDragging && (this.cameraMode === 'overview' || this.cameraMode === 'audience')) {
      const dx = e.clientX - this.lastMousePos.x;
      const dy = e.clientY - this.lastMousePos.y;
      this.targetMouseX += dx * 0.003;
      this.targetMouseY += dy * 0.003;
      this.targetMouseY = Math.max(-0.4, Math.min(0.4, this.targetMouseY));
      this.lastMousePos = { x: e.clientX, y: e.clientY };
      this.markActive();
    }
  }

  onPointerUp() {
    this.isDragging = false;
    this.markActive();
  }

  checkSeatHover() {
    if (!this.hasWebGL || this.isPaused) return;

    // Throttle seat hover checks to max 13fps (~75ms)
    const now = performance.now();
    if (now - this.lastHoverCheck < 75) return;
    this.lastHoverCheck = now;

    this.raycaster.setFromCamera(this.mouse, this.camera);
    // Raycast only seat meshes (10 objects) instead of the entire scene tree (hundreds of objects)
    const targets = this.seatMeshes.filter(Boolean);
    const intersects = this.raycaster.intersectObjects(targets, true);

    let foundSeat = null;
    for (const hit of intersects) {
      let obj = hit.object;
      while (obj && obj.userData?.seatId === undefined && obj.parent) {
        obj = obj.parent;
      }
      if (obj && obj.userData?.seatId !== undefined) {
        foundSeat = obj.userData.seatId;
        break;
      }
    }

    if (foundSeat !== this.hoveredSeat) {
      this.hoveredSeat = foundSeat;
      this.container.style.cursor = foundSeat !== null ? 'pointer' : (this.isDragging ? 'grabbing' : 'grab');
    }
  }

  onClick(e) {
    if (!this.hasWebGL || this.isPaused) return;
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const targets = this.seatMeshes.filter(Boolean);
    const intersects = this.raycaster.intersectObjects(targets, true);

    for (const hit of intersects) {
      let obj = hit.object;
      while (obj && obj.userData?.seatId === undefined && obj.parent) {
        obj = obj.parent;
      }
      if (obj && obj.userData?.seatId !== undefined) {
        if (typeof this.onSeatClick === 'function') {
          this.onSeatClick(obj.userData.seatId);
        }
        break;
      }
    }
  }

  onWindowResize() {
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;

    if (this.camera) {
      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();
    }

    if (this.hasWebGL && this.renderer) {
      this.renderer.setSize(width, height);
    }
    if (this.cssRenderer) {
      this.cssRenderer.setSize(width, height);
    }
  }

  animate() {
    if (this.isPaused) return;
    this.animationFrameId = requestAnimationFrame(() => this.animate());

    const now = performance.now();
    const targetPos = this.camTargetPos.clone();
    targetPos.x += Math.sin(this.mouseOffsetX) * 3;
    targetPos.y += this.mouseOffsetY * 2;

    // Check if camera is actively moving or interpolating
    const isCameraMoving = this.dollyActive ||
                           this.isFlipping ||
                           this.isDragging ||
                           Math.abs(this.mouseOffsetX - this.targetMouseX) > 0.002;

    // Check if scene has active dynamic animations (Party mode or floating emoji particles)
    const isDynamic = this.partyMode || this.floatingParticles.length > 0 || (now - this.lastActiveTime < 1800);

    // Adaptive target FPS: 60 FPS when active/moving, throttled to 24 FPS when idle watching movie
    const targetFps = (isCameraMoving || isDynamic) ? 60 : 24;
    const interval = 1000 / targetFps;

    if (now - this.lastRenderTime < interval - 2) {
      return;
    }
    this.lastRenderTime = now;

    const delta = Math.min(this.clock.getDelta(), 0.1);
    const time = this.clock.getElapsedTime();

    // Camera Interpolation: mượt mà, dứt khoát, không bồng bềnh hay chóng mặt
    this.mouseOffsetX += (this.targetMouseX - this.mouseOffsetX) * 0.1;
    this.mouseOffsetY += (this.targetMouseY - this.mouseOffsetY) * 0.1;

    if (this.dollyActive) {
      const t = Math.min(1, Math.max(0, (now - this.dollyStart) / this.dollyDuration));
      // Ease-in-out cubic: gia tốc êm ái, chuyển động điện ảnh mượt mà, hạ cánh nhẹ nhàng không khựng
      const ease = t < 0.5
        ? 4 * t * t * t
        : 1 - Math.pow(-2 * t + 2, 3) / 2;
      this.camera.position.lerpVectors(this.dollyFromPos, targetPos, ease);
      this.camCurrentLook.lerpVectors(this.dollyFromLook, this.camTargetLook, ease);
      this.camera.lookAt(this.camCurrentLook);

      if (t >= 1) {
        this.camera.position.copy(targetPos);
        this.camCurrentLook.copy(this.camTargetLook);
        this.camera.lookAt(this.camCurrentLook);
        this.dollyActive = false;
      }
    } else if (this.isFlipping) {
      this.camera.position.copy(targetPos);
      this.camCurrentLook.copy(this.camTargetLook);
      this.camera.lookAt(this.camCurrentLook);
    } else {
      if (this.isDragging) {
        this.camera.position.lerp(targetPos, 0.15);
        this.camCurrentLook.lerp(this.camTargetLook, 0.15);
      } else {
        this.camera.position.copy(targetPos);
        this.camCurrentLook.copy(this.camTargetLook);
      }
      this.camera.lookAt(this.camCurrentLook);
    }

    // Disco Ball Rotation & Spotlights
    if (this.discoBallGroup) {
      this.discoBallGroup.rotation.y += this.partyMode ? 0.03 : 0.005;
    }

    if (this.partyMode) {
      this.spotlights.forEach((spot, i) => {
        const angle = time * 1.5 + (i * Math.PI) / 2;
        spot.position.x = Math.sin(angle) * 7;
        spot.position.z = Math.cos(angle) * 6;
      });

      this.laserBeams.forEach((laser, i) => {
        laser.rotation.z = Math.sin(time * 2 + i) * 0.25;
      });

      const hue = (time * 0.25) % 1;
      if (this.goldTrimMat) {
        this.goldTrimMat.color.setHSL(hue, 0.85, 0.55);
        this.goldTrimMat.emissive.setHSL(hue, 0.9, 0.4);
        this.goldTrimMat.emissiveIntensity = 0.65;
      }
      if (this.stepStripMat) {
        this.stepStripMat.color.setHSL((hue + 0.33) % 1, 0.9, 0.55);
      }
      if (this.stageEdgeMat) {
        this.stageEdgeMat.color.setHSL((hue + 0.66) % 1, 0.9, 0.55);
      }
    }

    // Seated Avatars (seated naturally in chair)
    this.avatarMeshes.forEach((av, i) => {
      if (av && this.seatCoords[i]) {
        av.position.y = (this.seatCoords[i].y + 0.35) + Math.sin(time * 2 + i) * 0.015;
      }
    });

    // Floating Emojis
    for (let i = this.floatingParticles.length - 1; i >= 0; i--) {
      const p = this.floatingParticles[i];
      p.sprite.position.y += p.vy * delta;
      p.sprite.position.x += p.vx * delta;
      p.opacity -= delta * 0.45;
      p.sprite.material.opacity = Math.max(0, p.opacity);

      if (p.opacity <= 0 || p.sprite.position.y > 9) {
        this.scene.remove(p.sprite);
        p.sprite.material.map.dispose();
        p.sprite.material.dispose();
        this.floatingParticles.splice(i, 1);
      }
    }

    // Render WebGL and CSS3D
    if (this.hasWebGL && this.renderer) {
      this.renderer.render(this.scene, this.camera);
    }
    if (this.cssRenderer && this.cssScene) {
      this.cssRenderer.render(this.cssScene, this.camera);
    }
  }
}
