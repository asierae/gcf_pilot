import {
  AfterViewInit,
  Component,
  ElementRef,
  NgZone,
  OnDestroy,
  QueryList,
  ViewChild,
  ViewChildren,
} from '@angular/core';
import * as THREE from 'three';

type NodeKind = 'finance' | 'hub' | 'project';

interface HubSpec {
  key: string;
  name: string;
  role: string;
  detail: string;
  lat: number;
  lon: number;
  kind: NodeKind;
  color: number;
}

interface FlowHandle {
  curve: THREE.QuadraticBezierCurve3;
  material: THREE.ShaderMaterial;
  particles: THREE.Points;
  positions: Float32Array;
  offsets: Float32Array;
  speed: number;
  baseOpacity: number;
  highlight: number;
  target: number;
  sourceKey: string;
  refined: boolean;
}

interface PulseSprite {
  sprite: THREE.Sprite;
  baseScale: number;
  phase: number;
}

interface Ripple {
  mesh: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>;
  phase: number;
}

const GLOBE_RADIUS = 1.9;

@Component({
  selector: 'app-impact-globe',
  standalone: true,
  templateUrl: './impact-globe.component.html',
  styleUrl: './impact-globe.component.css',
})
export class ImpactGlobeComponent implements AfterViewInit, OnDestroy {
  @ViewChild('canvas', { static: true })
  private canvasRef!: ElementRef<HTMLCanvasElement>;

  @ViewChild('tip', { static: true })
  private tipRef!: ElementRef<HTMLDivElement>;

  @ViewChildren('globeLabel')
  private labelRefs!: QueryList<ElementRef<HTMLDivElement>>;

  private readonly hubs: HubSpec[] = [
    {
      key: 'ny',
      name: 'New York',
      role: 'Donor Source',
      detail: 'Private capital · blended finance',
      lat: 40.71,
      lon: -74.01,
      kind: 'finance',
      color: 0x37c8ff,
    },
    {
      key: 'lon',
      name: 'London',
      role: 'Donor Source',
      detail: 'Institutional investors · sovereign funds',
      lat: 51.51,
      lon: -0.13,
      kind: 'finance',
      color: 0x37c8ff,
    },
    {
      key: 'fra',
      name: 'Frankfurt',
      role: 'Donor Source',
      detail: 'Development finance · guarantees',
      lat: 50.11,
      lon: 8.68,
      kind: 'finance',
      color: 0x37c8ff,
    },
    {
      key: 'auh',
      name: 'Abu Dhabi',
      role: 'Donor Source',
      detail: 'Sovereign climate capital',
      lat: 24.45,
      lon: 54.38,
      kind: 'finance',
      color: 0x37c8ff,
    },
    {
      key: 'sin',
      name: 'Singapore',
      role: 'Donor Source',
      detail: 'Asia-Pacific capital markets',
      lat: 1.35,
      lon: 103.82,
      kind: 'finance',
      color: 0x37c8ff,
    },
    {
      key: 'tyo',
      name: 'Tokyo',
      role: 'Donor Source',
      detail: 'Green bonds · institutional capital',
      lat: 35.68,
      lon: 139.65,
      kind: 'finance',
      color: 0x37c8ff,
    },
    {
      key: 'gva',
      name: 'Geneva · Avera Hub',
      role: 'Avera Intervention',
      detail: 'Gap analysis · accreditation engineering',
      lat: 46.2,
      lon: 6.14,
      kind: 'hub',
      color: 0x2ee6c5,
    },
    {
      key: 'nbo',
      name: 'East Africa Impact Corridor',
      role: 'Impact Goal',
      detail: 'Clean energy · resilience · 1,280 MW illustrative',
      lat: -1.29,
      lon: 36.82,
      kind: 'project',
      color: 0x7dffb2,
    },
  ];

  private readonly flows: FlowHandle[] = [];
  private readonly hitMeshes: THREE.Mesh[] = [];
  private readonly pulseSprites: PulseSprite[] = [];
  private readonly ripples: Ripple[] = [];
  private readonly labelAnchors: THREE.Vector3[] = [];

  private readonly host: HTMLElement;
  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private world!: THREE.Group;
  private parallax!: THREE.Group;
  private projectIcon!: THREE.Mesh<THREE.IcosahedronGeometry, THREE.MeshBasicMaterial>;
  private hubRing!: THREE.Mesh<THREE.TorusGeometry, THREE.MeshBasicMaterial>;
  private glowTexture!: THREE.Texture;

  private readonly clock = new THREE.Clock();
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointerNdc = new THREE.Vector2(2, 2);
  private readonly tmpVec = new THREE.Vector3();
  private readonly tmpVec2 = new THREE.Vector3();
  private readonly tmpVec3 = new THREE.Vector3();
  private readonly worldCenter = new THREE.Vector3();

  private frameId = 0;
  private elapsed = 0;
  private scrollTarget = 0;
  private scrollProgress = 0;
  private autoYaw = -1.25;
  private hoveredKey: string | null = null;
  private pointerX = 0;
  private pointerY = 0;
  private pointerClientX = 0;
  private pointerClientY = 0;
  private reducedMotion = false;
  private inView = true;
  private projectAngle = 0;
  private resizeObserver?: ResizeObserver;
  private intersectionObserver?: IntersectionObserver;
  private disposed = false;

  constructor(host: ElementRef<HTMLElement>, private readonly zone: NgZone) {
    this.host = host.nativeElement;
  }

  ngAfterViewInit(): void {
    this.reducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;

    try {
      this.initScene();
    } catch {
      this.host.classList.add('globe-no-webgl');
      return;
    }

    this.zone.runOutsideAngular(() => {
      this.animate();
    });

    this.bindEvents();
  }

  ngOnDestroy(): void {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    this.resizeObserver?.disconnect();
    this.intersectionObserver?.disconnect();
    window.removeEventListener('scroll', this.onScroll);
    this.host.removeEventListener('pointermove', this.onPointerMove);
    this.host.removeEventListener('pointerleave', this.onPointerLeave);
    this.labelRefs?.forEach((ref) => {
      ref.nativeElement.removeEventListener('pointerenter', this.onLabelEnter);
      ref.nativeElement.removeEventListener('pointerleave', this.onLabelLeave);
    });
    this.disposeScene();
  }

  private initScene(): void {
    const canvas = this.canvasRef.nativeElement;
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.32;

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x0b1c29, 0.016);

    this.camera = new THREE.PerspectiveCamera(38, 1, 0.1, 120);
    this.camera.position.set(0.1, 0.35, 6.2);
    this.camera.lookAt(0.8, 0, 0);

    this.world = new THREE.Group();
    this.world.position.x = 0.8;
    this.scene.add(this.world);

    this.parallax = new THREE.Group();
    this.world.add(this.parallax);

    this.glowTexture = this.makeGlowTexture();

    const loader = new THREE.TextureLoader();
    const earthMap = loader.load('landing/earth-blue-marble.jpg');
    earthMap.colorSpace = THREE.SRGBColorSpace;
    earthMap.anisotropy = Math.min(this.renderer.capabilities.getMaxAnisotropy(), 8);

    const topology = loader.load('landing/earth-topology.png');
    topology.wrapS = THREE.RepeatWrapping;

    this.buildStarfield();
    this.buildGlobe(earthMap, topology);
    this.buildNodes();
    this.buildFlows();
    this.buildRipples();

    this.resize();
  }

  private buildStarfield(): void {
    const count = 900;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const teal = new THREE.Color(0x2ee6c5);
    const blue = new THREE.Color(0x8fb6d8);

    for (let i = 0; i < count; i += 1) {
      const r = 18 + Math.random() * 26;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.cos(phi);
      positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);

      const c = Math.random() > 0.86 ? teal : blue;
      const intensity = 0.35 + Math.random() * 0.65;
      colors[i * 3] = c.r * intensity;
      colors[i * 3 + 1] = c.g * intensity;
      colors[i * 3 + 2] = c.b * intensity;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      size: 0.075,
      vertexColors: true,
      transparent: true,
      opacity: 0.8,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
      map: this.glowTexture,
    });

    this.scene.add(new THREE.Points(geometry, material));
  }

  private buildGlobe(
    earthMap: THREE.Texture,
    topology: THREE.Texture,
  ): void {
    const globe = new THREE.Mesh(
      new THREE.SphereGeometry(GLOBE_RADIUS, 96, 96),
      new THREE.MeshBasicMaterial({
        map: earthMap,
        color: 0x8fb0c6,
      }),
    );
    this.parallax.add(globe);

    const oceanMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uMap: { value: topology },
        uDeep: { value: new THREE.Color(0x0e3c55) },
        uShallow: { value: new THREE.Color(0x2f8fb4) },
        uIntensity: { value: 0.95 },
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        varying vec3 vNormal;
        varying vec3 vViewDir;
        void main() {
          vUv = uv;
          vNormal = normalize(normalMatrix * normal);
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          vViewDir = normalize(-mvPosition.xyz);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform sampler2D uMap;
        uniform vec3 uDeep;
        uniform vec3 uShallow;
        uniform float uIntensity;
        varying vec2 vUv;
        varying vec3 vNormal;
        varying vec3 vViewDir;
        void main() {
          float raw = texture2D(uMap, vUv).r;
          float land = smoothstep(0.02, 0.07, raw);
          float ocean = 1.0 - land;
          float facing = max(dot(normalize(vNormal), normalize(vViewDir)), 0.0);
          float rim = pow(1.0 - facing, 3.0);
          vec3 color = mix(uDeep, uShallow, pow(facing, 0.75));
          color += uShallow * rim * 0.8;
          float alpha = ocean * (pow(facing, 0.9) * 0.55 + rim * 0.6) * uIntensity;
          gl_FragColor = vec4(color, alpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.FrontSide,
    });

    const oceanShell = new THREE.Mesh(
      new THREE.SphereGeometry(GLOBE_RADIUS * 1.001, 128, 128),
      oceanMaterial,
    );
    this.parallax.add(oceanShell);

    const contourMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uMap: { value: topology },
        uColor: { value: new THREE.Color(0x2ee6c5) },
        uIntensity: { value: 0.74 },
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        varying vec3 vNormal;
        varying vec3 vViewDir;
        void main() {
          vUv = uv;
          vNormal = normalize(normalMatrix * normal);
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          vViewDir = normalize(-mvPosition.xyz);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform sampler2D uMap;
        uniform vec3 uColor;
        uniform float uIntensity;
        varying vec2 vUv;
        varying vec3 vNormal;
        varying vec3 vViewDir;
        void main() {
          float raw = texture2D(uMap, vUv).r;
          float height = pow(raw, 0.62);
          float levels = 22.0;
          float band = abs(fract(height * levels + 0.5) - 0.5);
          float line = 1.0 - smoothstep(0.0, 0.07, band);
          float land = smoothstep(0.03, 0.12, height);
          float facing = pow(max(dot(normalize(vNormal), normalize(vViewDir)), 0.0), 1.35);
          float alpha = line * land * facing * uIntensity;
          if (alpha < 0.012) discard;
          vec3 color = mix(uColor, vec3(0.86, 1.0, 0.98), 0.32 * facing);
          gl_FragColor = vec4(color * (0.75 + line * 0.9), alpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.FrontSide,
    });

    const contourShell = new THREE.Mesh(
      new THREE.SphereGeometry(GLOBE_RADIUS * 1.002, 128, 128),
      contourMaterial,
    );
    this.parallax.add(contourShell);

    const atmosphere = new THREE.Mesh(
      new THREE.SphereGeometry(GLOBE_RADIUS * 1.14, 64, 64),
      new THREE.ShaderMaterial({
        uniforms: {
          uColor: { value: new THREE.Color(0x1fbfae) },
        },
        vertexShader: /* glsl */ `
          varying vec3 vNormal;
          varying vec3 vViewDir;
          void main() {
            vNormal = normalize(normalMatrix * normal);
            vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
            vViewDir = normalize(-mvPosition.xyz);
            gl_Position = projectionMatrix * mvPosition;
          }
        `,
        fragmentShader: /* glsl */ `
          uniform vec3 uColor;
          varying vec3 vNormal;
          varying vec3 vViewDir;
          void main() {
            float rim = 1.0 - abs(dot(normalize(vNormal), normalize(vViewDir)));
            float intensity = pow(rim, 3.2);
            gl_FragColor = vec4(uColor, intensity * 0.4);
          }
        `,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.BackSide,
      }),
    );
    this.parallax.add(atmosphere);
  }

  private buildNodes(): void {
    this.labelAnchors.length = 0;

    for (const hub of this.hubs) {
      const position = this.latLonToVector3(hub.lat, hub.lon, GLOBE_RADIUS * 1.005);
      const size = hub.kind === 'hub' ? 0.058 : hub.kind === 'project' ? 0.05 : 0.032;

      const marker = new THREE.Mesh(
        new THREE.SphereGeometry(size, 18, 18),
        new THREE.MeshBasicMaterial({ color: hub.color }),
      );
      marker.position.copy(position);
      this.parallax.add(marker);

      const glow = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: this.glowTexture,
          color: hub.color,
          transparent: true,
          opacity: hub.kind === 'finance' ? 0.55 : 0.9,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      );
      glow.position.copy(position);
      const glowScale = hub.kind === 'hub' ? 0.62 : hub.kind === 'project' ? 0.55 : 0.24;
      glow.scale.setScalar(glowScale);
      this.parallax.add(glow);
      this.pulseSprites.push({
        sprite: glow,
        baseScale: glowScale,
        phase: Math.random() * Math.PI * 2,
      });

      const hit = new THREE.Mesh(
        new THREE.SphereGeometry(hub.kind === 'finance' ? 0.11 : 0.15, 12, 12),
        new THREE.MeshBasicMaterial({ visible: false }),
      );
      hit.position.copy(position);
      hit.userData = hub;
      this.parallax.add(hit);
      this.hitMeshes.push(hit);

      if (hub.kind === 'project') {
        this.projectIcon = new THREE.Mesh(
          new THREE.IcosahedronGeometry(0.085, 0),
          new THREE.MeshBasicMaterial({
            color: 0x7dffb2,
            wireframe: true,
            transparent: true,
            opacity: 0.85,
          }),
        );
        this.projectIcon.position.copy(position.clone().multiplyScalar(1.035));
        this.parallax.add(this.projectIcon);

        const core = new THREE.Mesh(
          new THREE.IcosahedronGeometry(0.042, 0),
          new THREE.MeshBasicMaterial({ color: 0xd9fff0 }),
        );
        core.position.copy(this.projectIcon.position);
        this.parallax.add(core);
        this.projectAngle = Math.atan2(position.x, position.z);
      }

      if (hub.kind === 'hub') {
        this.hubRing = new THREE.Mesh(
          new THREE.TorusGeometry(0.13, 0.004, 8, 96),
          new THREE.MeshBasicMaterial({
            color: 0x2ee6c5,
            transparent: true,
            opacity: 0.7,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
          }),
        );
        this.hubRing.position.copy(position.clone().multiplyScalar(1.01));
        this.hubRing.quaternion.setFromUnitVectors(
          new THREE.Vector3(0, 0, 1),
          position.clone().normalize(),
        );
        this.parallax.add(this.hubRing);
      }

      if (hub.key === 'ny' || hub.key === 'gva' || hub.key === 'nbo') {
        this.labelAnchors.push(position.clone().multiplyScalar(1.14));
      }
    }
  }

  private buildFlows(): void {
    const hub = this.hubs.find((item) => item.kind === 'hub');
    const project = this.hubs.find((item) => item.kind === 'project');
    if (!hub || !project) {
      return;
    }

    const hubPos = this.latLonToVector3(hub.lat, hub.lon, GLOBE_RADIUS * 1.005);
    const projectPos = this.latLonToVector3(
      project.lat,
      project.lon,
      GLOBE_RADIUS * 1.005,
    );

    const financeHubs = this.hubs.filter((item) => item.kind === 'finance');
    for (const source of financeHubs) {
      const start = this.latLonToVector3(
        source.lat,
        source.lon,
        GLOBE_RADIUS * 1.005,
      );
      const distance = start.distanceTo(hubPos);
      const control = start
        .clone()
        .add(hubPos)
        .multiplyScalar(0.5)
        .normalize()
        .multiplyScalar(GLOBE_RADIUS * (1.18 + distance * 0.28));

      this.createFlow(
        new THREE.QuadraticBezierCurve3(start, control, hubPos),
        {
          color: 0x37c8ff,
          radius: 0.0042,
          count: 20,
          speed: 0.16 + Math.random() * 0.06,
          opacity: 0.85,
          sourceKey: source.key,
          refined: false,
        },
      );
    }

    const refinedSpecs: Array<{ lift: number; radius: number; color: number }> = [
      { lift: 0.13, radius: 0.0055, color: 0x2ee6c5 },
      { lift: 0.2, radius: 0.0036, color: 0x6fffe0 },
      { lift: 0.28, radius: 0.0028, color: 0x9bffe8 },
    ];

    for (const spec of refinedSpecs) {
      const control = hubPos
        .clone()
        .add(projectPos)
        .multiplyScalar(0.5)
        .normalize()
        .multiplyScalar(GLOBE_RADIUS * (1 + spec.lift));

      this.createFlow(
        new THREE.QuadraticBezierCurve3(hubPos, control, projectPos),
        {
          color: spec.color,
          radius: spec.radius,
          count: 30,
          speed: 0.2 + Math.random() * 0.05,
          opacity: 1,
          sourceKey: 'gva',
          refined: true,
        },
      );
    }
  }

  private createFlow(
    curve: THREE.QuadraticBezierCurve3,
    options: {
      color: number;
      radius: number;
      count: number;
      speed: number;
      opacity: number;
      sourceKey: string;
      refined: boolean;
    },
  ): void {
    const material = new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: new THREE.Color(options.color) },
        uTime: { value: 0 },
        uOpacity: { value: options.opacity },
        uHighlight: { value: 0 },
        uBands: { value: options.refined ? 3.4 : 2.2 },
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor;
        uniform float uTime;
        uniform float uOpacity;
        uniform float uHighlight;
        uniform float uBands;
        varying vec2 vUv;
        void main() {
          float edge = pow(sin(clamp(vUv.y, 0.0, 1.0) * 3.141592), 0.75);
          float flow = fract(vUv.x * uBands - uTime * 0.42);
          float pulse = smoothstep(0.0, 0.32, flow) * smoothstep(1.0, 0.68, flow);
          float alpha = (0.08 + pulse * 0.55 + uHighlight * 0.22) * uOpacity * edge;
          vec3 color = uColor * (0.65 + pulse * 1.9 + uHighlight * 1.1);
          gl_FragColor = vec4(color, alpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });

    const tube = new THREE.Mesh(
      new THREE.TubeGeometry(curve, 96, options.radius, 6, false),
      material,
    );
    this.parallax.add(tube);

    const positions = new Float32Array(options.count * 3);
    const offsets = new Float32Array(options.count);
    for (let i = 0; i < options.count; i += 1) {
      offsets[i] = i / options.count + Math.random() * 0.02;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const particleMaterial = new THREE.PointsMaterial({
      map: this.glowTexture,
      color: options.color,
      size: options.refined ? 0.075 : 0.055,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    });

    const particles = new THREE.Points(geometry, particleMaterial);
    this.parallax.add(particles);

    this.flows.push({
      curve,
      material,
      particles,
      positions,
      offsets,
      speed: options.speed,
      baseOpacity: options.opacity,
      highlight: 0,
      target: 0,
      sourceKey: options.sourceKey,
      refined: options.refined,
    });
  }

  private buildRipples(): void {
    const project = this.hubs.find((item) => item.kind === 'project');
    if (!project) {
      return;
    }

    const position = this.latLonToVector3(
      project.lat,
      project.lon,
      GLOBE_RADIUS * 1.008,
    );
    const normal = position.clone().normalize();
    const quaternion = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 0, 1),
      normal,
    );

    for (let i = 0; i < 3; i += 1) {
      const mesh = new THREE.Mesh(
        new THREE.RingGeometry(0.86, 1, 96),
        new THREE.MeshBasicMaterial({
          color: 0x7dffb2,
          transparent: true,
          opacity: 0.4,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          side: THREE.DoubleSide,
        }),
      );
      mesh.position.copy(position);
      mesh.quaternion.copy(quaternion);
      mesh.scale.setScalar(0.2);
      this.parallax.add(mesh);
      this.ripples.push({ mesh, phase: i / 3 });
    }
  }

  private animate = (): void => {
    if (this.disposed) {
      return;
    }

    this.frameId = requestAnimationFrame(this.animate);
    if (!this.inView) {
      return;
    }

    const delta = Math.min(this.clock.getDelta(), 0.05);
    this.elapsed += delta;

    this.scrollProgress += (this.scrollTarget - this.scrollProgress) * 0.07;
    const p = this.smoothstep(this.scrollProgress);

    this.autoYaw += delta * (this.reducedMotion ? 0 : 0.035) * (1 - p);
    const targetYaw = -this.projectAngle;
    const yaw = THREE.MathUtils.lerp(this.autoYaw, targetYaw, this.smoothstepRange(p, 0.45, 1));
    this.world.rotation.y = yaw;
    this.world.rotation.x = THREE.MathUtils.lerp(-0.3, -0.02, p);
    this.world.position.x = THREE.MathUtils.lerp(0.8, 0.12, p);

    this.parallax.rotation.x = THREE.MathUtils.lerp(
      this.parallax.rotation.x,
      -this.pointerY * 0.045 * (1 - p),
      0.06,
    );
    this.parallax.rotation.y = THREE.MathUtils.lerp(
      this.parallax.rotation.y,
      this.pointerX * 0.045 * (1 - p),
      0.06,
    );

    const cameraZ = THREE.MathUtils.lerp(6.25, 4.5, p);
    this.camera.position.z += (cameraZ - this.camera.position.z) * 0.08;
    this.camera.position.x += (0.1 - this.camera.position.x) * 0.08;
    this.camera.position.y += (0.35 + p * 0.1 - this.camera.position.y) * 0.08;
    this.camera.lookAt(this.world.position.x, 0, 0);

    for (const pulse of this.pulseSprites) {
      const wave = 0.82 + Math.sin(this.elapsed * 1.9 + pulse.phase) * 0.18;
      pulse.sprite.scale.setScalar(pulse.baseScale * wave);
    }

    if (this.projectIcon) {
      const growth = 1 + Math.sin(this.elapsed * 2.1) * 0.14;
      this.projectIcon.scale.setScalar(growth);
      this.projectIcon.rotation.y += delta * 0.6;
      this.projectIcon.rotation.x += delta * 0.28;
    }

    if (this.hubRing) {
      this.hubRing.rotation.z += delta * 0.35;
      const opacity = 0.45 + Math.sin(this.elapsed * 2.4) * 0.2;
      this.hubRing.material.opacity = opacity;
    }

    for (const ripple of this.ripples) {
      const t = (this.elapsed * 0.22 + ripple.phase) % 1;
      const scale = 0.18 + t * 1.45;
      ripple.mesh.scale.setScalar(scale);
      ripple.mesh.material.opacity = (1 - t) * 0.45;
    }

    for (const flow of this.flows) {
      const target = flow.target;
      flow.highlight += (target - flow.highlight) * 0.1;
      flow.material.uniforms['uTime'].value = this.elapsed;
      flow.material.uniforms['uHighlight'].value = flow.highlight;

      const attribute = flow.particles.geometry.getAttribute(
        'position',
      ) as THREE.BufferAttribute;
      const speed = this.reducedMotion ? flow.speed * 0.25 : flow.speed;
      for (let i = 0; i < flow.offsets.length; i += 1) {
        const t = (this.elapsed * speed + flow.offsets[i]) % 1;
        flow.curve.getPointAt(t, this.tmpVec);
        attribute.setXYZ(i, this.tmpVec.x, this.tmpVec.y, this.tmpVec.z);
      }
      attribute.needsUpdate = true;
    }

    this.updateLabels();

    this.renderer.render(this.scene, this.camera);
  };

  private updateLabels(): void {
    if (!this.labelRefs || !this.camera) {
      return;
    }

    const labels = this.labelRefs.toArray();
    const rect = this.host.getBoundingClientRect();
    if (!rect.width || !rect.height) {
      return;
    }

    this.worldCenter.copy(this.world.position);
    this.tmpVec3.copy(this.camera.position).sub(this.worldCenter);
    const placed: Array<{ x: number; y: number }> = [];

    labels.forEach((label, index) => {
      const anchor = this.labelAnchors[index];
      if (!anchor) {
        return;
      }

      const element = label.nativeElement;
      this.tmpVec.copy(anchor);
      this.parallax.localToWorld(this.tmpVec);
      this.tmpVec2.copy(this.tmpVec).sub(this.worldCenter);

      const visible =
        this.tmpVec2.dot(this.tmpVec3) > GLOBE_RADIUS * GLOBE_RADIUS * 1.02;

      if (!visible) {
        element.style.opacity = '0';
        element.style.pointerEvents = 'none';
        return;
      }

      const projected = this.tmpVec.clone().project(this.camera);
      const rawX = (projected.x * 0.5 + 0.5) * rect.width;
      const rawY = (-projected.y * 0.5 + 0.5) * rect.height;
      const maxX = rect.width > 1180 ? rect.width - 430 : rect.width - 90;
      const x = THREE.MathUtils.clamp(rawX, 90, Math.max(maxX, 90));
      let y = THREE.MathUtils.clamp(rawY, 104, rect.height - 44);

      for (const prev of placed) {
        if (Math.abs(prev.x - x) < 205 && Math.abs(prev.y - y) < 52) {
          y = Math.min(prev.y + 58, rect.height - 44);
        }
      }
      placed.push({ x, y });

      element.style.opacity = '1';
      element.style.pointerEvents = 'auto';
      element.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%)`;
    });
  }

  private bindEvents(): void {
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.host);

    this.intersectionObserver = new IntersectionObserver(
      (entries) => {
        this.inView = entries.some((entry) => entry.isIntersecting);
        if (this.inView) {
          this.clock.getDelta();
        }
      },
      { threshold: 0.02 },
    );
    this.intersectionObserver.observe(this.host);

    window.addEventListener('scroll', this.onScroll, { passive: true });
    this.onScroll();

    this.host.addEventListener('pointermove', this.onPointerMove);
    this.host.addEventListener('pointerleave', this.onPointerLeave);

    this.labelRefs?.forEach((ref) => {
      ref.nativeElement.addEventListener('pointerenter', this.onLabelEnter);
      ref.nativeElement.addEventListener('pointerleave', this.onLabelLeave);
    });
  }

  private resize(): void {
    if (!this.renderer) {
      return;
    }

    const rect = this.host.getBoundingClientRect();
    const width = Math.max(rect.width, 1);
    const height = Math.max(rect.height, 1);

    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  private onScroll = (): void => {
    const stage = document.querySelector('.avera-hero-stage') as HTMLElement | null;
    const total = stage ? stage.offsetHeight - window.innerHeight : 1;
    this.scrollTarget = THREE.MathUtils.clamp(
      window.scrollY / Math.max(total, 1),
      0,
      1,
    );
  };

  private onPointerMove = (event: PointerEvent): void => {
    const target = event.target as HTMLElement | null;
    if (target?.closest('.globe-label')) {
      return;
    }

    const rect = this.host.getBoundingClientRect();
    this.pointerClientX = event.clientX - rect.left;
    this.pointerClientY = event.clientY - rect.top;
    this.pointerX = (this.pointerClientX / rect.width) * 2 - 1;
    this.pointerY = (this.pointerClientY / rect.height) * 2 - 1;
    this.pointerNdc.set(this.pointerX, -this.pointerY);

    this.raycaster.setFromCamera(this.pointerNdc, this.camera);
    const intersects = this.raycaster.intersectObjects(this.hitMeshes, false);
    const hit = intersects[0]?.object.userData as HubSpec | undefined;

    if (hit) {
      this.setHovered(hit.key);
      this.showTooltip(hit);
      this.host.style.cursor = 'pointer';
    } else {
      this.setHovered(null);
      this.hideTooltip();
      this.host.style.cursor = '';
    }
  };

  private onPointerLeave = (): void => {
    this.setHovered(null);
    this.hideTooltip();
    this.pointerX = 0;
    this.pointerY = 0;
    this.pointerNdc.set(2, 2);
    this.host.style.cursor = '';
  };

  private onLabelEnter = (event: Event): void => {
    const element = event.currentTarget as HTMLElement;
    const keyByKind: Record<string, string> = {
      finance: 'finance',
      hub: 'gva',
      project: 'nbo',
    };
    const key = keyByKind[element.dataset['kind'] ?? ''] ?? null;
    if (!key) {
      return;
    }
    this.setHovered(key);

    const hostRect = this.host.getBoundingClientRect();
    const labelRect = element.getBoundingClientRect();
    this.pointerClientX = labelRect.right - hostRect.left;
    this.pointerClientY = labelRect.top + labelRect.height / 2 - hostRect.top;

    const hub = this.hubs.find((item) => item.key === key);
    if (hub) {
      this.showTooltip(hub);
    }
  };

  private onLabelLeave = (): void => {
    this.setHovered(null);
    this.hideTooltip();
  };

  private setHovered(key: string | null): void {
    if (this.hoveredKey === key) {
      return;
    }
    this.hoveredKey = key;

    for (const flow of this.flows) {
      if (!key) {
        flow.target = 0;
      } else if (key === 'gva') {
        flow.target = 1;
      } else if (key === 'nbo') {
        flow.target = flow.refined ? 1 : 0.12;
      } else {
        flow.target = flow.sourceKey === key ? 1 : 0.1;
      }
    }

    this.labelRefs?.forEach((ref) => {
      const kind = ref.nativeElement.dataset['kind'];
      const active =
        !key ||
        kind === key ||
        (key === 'gva' && kind === 'hub') ||
        (key === 'nbo' && kind === 'project') ||
        (kind === 'finance' && key !== 'gva' && key !== 'nbo');
      ref.nativeElement.classList.toggle('is-dimmed', !active);
    });
  }

  private showTooltip(hub: HubSpec): void {
    const tip = this.tipRef.nativeElement;
    (tip.querySelector('.globe-tip-role') as HTMLElement).textContent = hub.role;
    (tip.querySelector('.globe-tip-title') as HTMLElement).textContent = hub.name;
    (tip.querySelector('.globe-tip-detail') as HTMLElement).textContent =
      hub.detail;

    const x = Math.min(this.pointerClientX + 22, this.host.clientWidth - 230);
    const y = Math.max(this.pointerClientY - 14, 12);
    tip.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    tip.classList.add('is-visible');
  }

  private hideTooltip(): void {
    this.tipRef.nativeElement.classList.remove('is-visible');
  }

  private latLonToVector3(lat: number, lon: number, radius: number): THREE.Vector3 {
    const phi = ((90 - lat) * Math.PI) / 180;
    const theta = ((lon + 180) * Math.PI) / 180;
    return new THREE.Vector3(
      -radius * Math.sin(phi) * Math.cos(theta),
      radius * Math.cos(phi),
      radius * Math.sin(phi) * Math.sin(theta),
    );
  }

  private makeGlowTexture(): THREE.Texture {
    const size = 128;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return new THREE.Texture();
    }
    const gradient = ctx.createRadialGradient(
      size / 2,
      size / 2,
      0,
      size / 2,
      size / 2,
      size / 2,
    );
    gradient.addColorStop(0, 'rgba(255,255,255,1)');
    gradient.addColorStop(0.3, 'rgba(190,255,245,0.72)');
    gradient.addColorStop(0.65, 'rgba(80,220,210,0.18)');
    gradient.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  private smoothstep(value: number): number {
    return value * value * (3 - 2 * value);
  }

  private smoothstepRange(value: number, min: number, max: number): number {
    const x = THREE.MathUtils.clamp((value - min) / Math.max(max - min, 0.0001), 0, 1);
    return x * x * (3 - 2 * x);
  }

  private disposeScene(): void {
    this.scene?.traverse((object) => {
      const mesh = object as THREE.Mesh;
      mesh.geometry?.dispose?.();
      const material = mesh.material;
      if (Array.isArray(material)) {
        material.forEach((item) => item.dispose());
      } else {
        material?.dispose?.();
      }
    });
    this.glowTexture?.dispose();
    this.renderer?.dispose();
    this.renderer?.forceContextLoss?.();
  }
}
