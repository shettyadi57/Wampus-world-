/**
 * CameraController.js
 * ─────────────────────────────────────────────────────────────
 * Multi-mode camera controller: Chase, Hood, Cockpit.
 * Supports independently toggleable smoothing, suspension motion,
 * and speed-based dynamic FOV.
 */

import * as THREE from 'three';

export class CameraController {
  /**
   * @param {THREE.PerspectiveCamera} camera
   * @param {import('../vehicle/VehicleController.js').VehicleController} vehicle
   * @param {Object} [options]
   */
  constructor(camera, vehicle, options = {}) {
    this.camera = camera;
    this.vehicle = vehicle;

    // Camera modes: 'chase' | 'hood' | 'cockpit'
    this.mode = options.mode ?? 'chase';

    // Independently toggleable settings
    this.settings = {
      smoothing: options.smoothing ?? true,
      suspensionMotion: options.suspensionMotion ?? true,
      speedFov: options.speedFov ?? true,
    };

    // FOV parameters
    this.baseFov = 62;
    this.maxFov = 76;
    this.currentFov = this.baseFov;

    // Smoothed internal positions
    this._currentPos = new THREE.Vector3();
    this._currentTarget = new THREE.Vector3();
    this._initialized = false;
  }

  setMode(mode) {
    if (['chase', 'hood', 'cockpit'].includes(mode)) {
      this.mode = mode;
      console.log(`[camera] Mode switched to: ${mode}`);
    }
  }

  cycleMode() {
    const modes = ['chase', 'hood', 'cockpit'];
    const nextIdx = (modes.indexOf(this.mode) + 1) % modes.length;
    this.setMode(modes[nextIdx]);
    return this.mode;
  }

  toggleSetting(name) {
    if (this.settings[name] !== undefined) {
      this.settings[name] = !this.settings[name];
      console.log(`[camera] Setting "${name}" toggled to: ${this.settings[name]}`);
      return this.settings[name];
    }
    return false;
  }

  update(dt) {
    if (!this.vehicle || !this.camera) return;
    if (dt <= 0 || dt > 0.1) dt = 0.0166;

    const vp = this.vehicle.position;
    const yaw = this.vehicle.yaw;
    const pitch = this.settings.suspensionMotion ? this.vehicle.pitch : 0;
    const roll = this.settings.suspensionMotion ? this.vehicle.roll : 0;
    const heave = this.settings.suspensionMotion ? this.vehicle.suspensionHeave : 0;

    // Forward and right vectors from vehicle yaw
    const forward = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
    const right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
    const up = new THREE.Vector3(0, 1, 0);

    let desiredPos = new THREE.Vector3();
    let desiredTarget = new THREE.Vector3();

    if (this.mode === 'chase') {
      // Behind and slightly above vehicle
      const chaseDist = 5.6;
      const chaseHeight = 2.4;
      const lookAhead = 4.0;

      desiredPos
        .set(vp.x, vp.y + chaseHeight + heave * 0.5, vp.z)
        .sub(forward.clone().multiplyScalar(chaseDist))
        .add(right.clone().multiplyScalar(roll * 0.3));

      desiredTarget
        .set(vp.x, vp.y + 1.2 + heave * 0.5, vp.z)
        .add(forward.clone().multiplyScalar(lookAhead));

    } else if (this.mode === 'hood') {
      // On the hood, looking forward
      desiredPos
        .set(vp.x, vp.y + 1.1 + heave, vp.z)
        .add(forward.clone().multiplyScalar(1.2));

      desiredTarget
        .set(vp.x, vp.y + 1.1 + heave + pitch * 1.5, vp.z)
        .add(forward.clone().multiplyScalar(15.0));

    } else if (this.mode === 'cockpit') {
      // Driver's seat inside cabin
      desiredPos
        .set(vp.x, vp.y + 1.22 + heave, vp.z)
        .add(right.clone().multiplyScalar(-0.35))
        .add(forward.clone().multiplyScalar(0.05));

      desiredTarget
        .set(vp.x, vp.y + 1.2 + heave + pitch * 1.5, vp.z)
        .add(right.clone().multiplyScalar(-0.35 + roll * 0.5))
        .add(forward.clone().multiplyScalar(12.0));
    }

    // Camera smoothing
    if (!this._initialized || !this.settings.smoothing) {
      this._currentPos.copy(desiredPos);
      this._currentTarget.copy(desiredTarget);
      this._initialized = true;
    } else {
      const posLerp = this.mode === 'chase' ? Math.min(1, 10 * dt) : Math.min(1, 24 * dt);
      const targetLerp = this.mode === 'chase' ? Math.min(1, 14 * dt) : Math.min(1, 28 * dt);

      this._currentPos.lerp(desiredPos, posLerp);
      this._currentTarget.lerp(desiredTarget, targetLerp);
    }

    this.camera.position.copy(this._currentPos);
    this.camera.lookAt(this._currentTarget);

    // Roll angle on camera for cockpit/hood
    if (this.settings.suspensionMotion && (this.mode === 'cockpit' || this.mode === 'hood')) {
      this.camera.rotation.z += roll * 0.5;
    }

    // Dynamic speed-based FOV
    if (this.settings.speedFov) {
      const speed = this.vehicle.getSpeedKph();
      const speedNorm = Math.min(1.0, speed / 110.0);
      const targetFov = this.baseFov + (this.maxFov - this.baseFov) * (speedNorm * speedNorm);
      this.currentFov += (targetFov - this.currentFov) * Math.min(1, 6 * dt);
      if (Math.abs(this.camera.fov - this.currentFov) > 0.05) {
        this.camera.fov = this.currentFov;
        this.camera.updateProjectionMatrix();
      }
    } else if (this.camera.fov !== this.baseFov) {
      this.camera.fov = this.baseFov;
      this.camera.updateProjectionMatrix();
    }
  }
}
