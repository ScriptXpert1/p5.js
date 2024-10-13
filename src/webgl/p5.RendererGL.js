import * as constants from '../core/constants';
import GeometryBuilder from './GeometryBuilder';
import libtess from 'libtess'; // Fixed with exporting module from libtess
import { Renderer } from '../core/p5.Renderer';
import { Matrix } from './p5.Matrix';
import { Camera } from './p5.Camera';
import { Vector } from '../math/p5.Vector';
import { RenderBuffer } from './p5.RenderBuffer';
import { Geometry } from './p5.Geometry';
import { DataArray } from './p5.DataArray';
import { Shader } from './p5.Shader';
import { Image } from '../image/p5.Image';
import { Texture } from './p5.Texture';

import lightingShader from './shaders/lighting.glsl';
import webgl2CompatibilityShader from './shaders/webgl2Compatibility.glsl';
import immediateVert from './shaders/immediate.vert';
import vertexColorVert from './shaders/vertexColor.vert';
import vertexColorFrag from './shaders/vertexColor.frag';
import normalVert from './shaders/normal.vert';
import normalFrag from './shaders/normal.frag';
import basicFrag from './shaders/basic.frag';
import sphereMappingFrag from './shaders/sphereMapping.frag';
import lightVert from './shaders/light.vert';
import lightTextureFrag from './shaders/light_texture.frag';
import phongVert from './shaders/phong.vert';
import phongFrag from './shaders/phong.frag';
import fontVert from './shaders/font.vert';
import fontFrag from './shaders/font.frag';
import lineVert from './shaders/line.vert';
import lineFrag from './shaders/line.frag';
import pointVert from './shaders/point.vert';
import pointFrag from './shaders/point.frag';
import imageLightVert from './shaders/imageLight.vert';
import imageLightDiffusedFrag from './shaders/imageLightDiffused.frag';
import imageLightSpecularFrag from './shaders/imageLightSpecular.frag';

import filterGrayFrag from './shaders/filters/gray.frag';
import filterErodeFrag from './shaders/filters/erode.frag';
import filterDilateFrag from './shaders/filters/dilate.frag';
import filterBlurFrag from './shaders/filters/blur.frag';
import filterPosterizeFrag from './shaders/filters/posterize.frag';
import filterOpaqueFrag from './shaders/filters/opaque.frag';
import filterInvertFrag from './shaders/filters/invert.frag';
import filterThresholdFrag from './shaders/filters/threshold.frag';
import filterShaderVert from './shaders/filters/default.vert';

const STROKE_CAP_ENUM = {};
const STROKE_JOIN_ENUM = {};
let lineDefs = '';
const defineStrokeCapEnum = function (key, val) {
  lineDefs += `#define STROKE_CAP_${key} ${val}\n`;
  STROKE_CAP_ENUM[constants[key]] = val;
};
const defineStrokeJoinEnum = function (key, val) {
  lineDefs += `#define STROKE_JOIN_${key} ${val}\n`;
  STROKE_JOIN_ENUM[constants[key]] = val;
};


// Define constants in line shaders for each type of cap/join, and also record
// the values in JS objects
defineStrokeCapEnum('ROUND', 0);
defineStrokeCapEnum('PROJECT', 1);
defineStrokeCapEnum('SQUARE', 2);
defineStrokeJoinEnum('ROUND', 0);
defineStrokeJoinEnum('MITER', 1);
defineStrokeJoinEnum('BEVEL', 2);

const defaultShaders = {
  immediateVert,
  vertexColorVert,
  vertexColorFrag,
  normalVert,
  normalFrag,
  basicFrag,
  sphereMappingFrag,
  lightVert:
    lightingShader +
    lightVert,
  lightTextureFrag,
  phongVert,
  phongFrag:
    lightingShader +
    phongFrag,
  fontVert,
  fontFrag,
  lineVert:
    lineDefs + lineVert,
  lineFrag:
    lineDefs + lineFrag,
  pointVert,
  pointFrag,
  imageLightVert,
  imageLightDiffusedFrag,
  imageLightSpecularFrag
};
let sphereMapping = defaultShaders.sphereMappingFrag;
for (const key in defaultShaders) {
  defaultShaders[key] = webgl2CompatibilityShader + defaultShaders[key];
}

const filterShaderFrags = {
  [constants.GRAY]: filterGrayFrag,
  [constants.ERODE]: filterErodeFrag,
  [constants.DILATE]: filterDilateFrag,
  [constants.BLUR]: filterBlurFrag,
  [constants.POSTERIZE]: filterPosterizeFrag,
  [constants.OPAQUE]: filterOpaqueFrag,
  [constants.INVERT]: filterInvertFrag,
  [constants.THRESHOLD]: filterThresholdFrag
};

/**
 * 3D graphics class
 * @private
 * @class p5.RendererGL
 * @extends p5.Renderer
 * @todo extend class to include public method for offscreen
 * rendering (FBO).
 */
class RendererGL extends Renderer {
  constructor(pInst, w, h, isMainCanvas, elt, attr) {
    super(pInst, w, h, isMainCanvas);

    // Create new canvas
    this.canvas = this.elt = elt || document.createElement('canvas');
    this._initContext();
    // This redundant property is useful in reminding you that you are
    // interacting with WebGLRenderingContext, still worth considering future removal
    this.GL = this.drawingContext;
    this._pInst.drawingContext = this.drawingContext;

    if (this._isMainCanvas) {
      // for pixel method sharing with pimage
      this._pInst._curElement = this;
      this._pInst.canvas = this.canvas;
    } else {
      // hide if offscreen buffer by default
      this.canvas.style.display = 'none';
    }
    this.elt.id = 'defaultCanvas0';
    this.elt.classList.add('p5Canvas');

    const dimensions = this._adjustDimensions(w, h);
    w = dimensions.adjustedWidth;
    h = dimensions.adjustedHeight;

    this.width = w;
    this.height = h;

    // Set canvas size
    this.elt.width = w * this._pixelDensity;
    this.elt.height = h * this._pixelDensity;
    this.elt.style.width = `${w}px`;
    this.elt.style.height = `${h}px`;
    this._origViewport = {
      width: this.GL.drawingBufferWidth,
      height: this.GL.drawingBufferHeight
    };
    this.viewport(
      this._origViewport.width,
      this._origViewport.height
    );

    // Attach canvas element to DOM
    if (this._pInst._userNode) {
      // user input node case
      this._pInst._userNode.appendChild(this.elt);
    } else {
      //create main element
      if (document.getElementsByTagName('main').length === 0) {
        let m = document.createElement('main');
        document.body.appendChild(m);
      }
      //append canvas to main
      document.getElementsByTagName('main')[0].appendChild(this.elt);
    }

    this._setAttributeDefaults(pInst);
    this.isP3D = true; //lets us know we're in 3d mode

    // When constructing a new Geometry, this will represent the builder
    this.geometryBuilder = undefined;

    // Push/pop state
    this.states.uModelMatrix = new Matrix();
    this.states.uViewMatrix = new Matrix();
    this.states.uMVMatrix = new Matrix();
    this.states.uPMatrix = new Matrix();
    this.states.uNMatrix = new Matrix('mat3');
    this.states.curMatrix = new Matrix('mat3');

    this.states.curCamera = new Camera(this);

    this.states.enableLighting = false;
    this.states.ambientLightColors = [];
    this.states.specularColors = [1, 1, 1];
    this.states.directionalLightDirections = [];
    this.states.directionalLightDiffuseColors = [];
    this.states.directionalLightSpecularColors = [];
    this.states.pointLightPositions = [];
    this.states.pointLightDiffuseColors = [];
    this.states.pointLightSpecularColors = [];
    this.states.spotLightPositions = [];
    this.states.spotLightDirections = [];
    this.states.spotLightDiffuseColors = [];
    this.states.spotLightSpecularColors = [];
    this.states.spotLightAngle = [];
    this.states.spotLightConc = [];
    this.states.activeImageLight = null;

    this.states.curFillColor = [1, 1, 1, 1];
    this.states.curAmbientColor = [1, 1, 1, 1];
    this.states.curSpecularColor = [0, 0, 0, 0];
    this.states.curEmissiveColor = [0, 0, 0, 0];
    this.states.curStrokeColor = [0, 0, 0, 1];

    this.states.curBlendMode = constants.BLEND;

    this.states._hasSetAmbient = false;
    this.states._useSpecularMaterial = false;
    this.states._useEmissiveMaterial = false;
    this.states._useNormalMaterial = false;
    this.states._useShininess = 1;
    this.states._useMetalness = 0;

    this.states.tint = [255, 255, 255, 255];

    this.states.constantAttenuation = 1;
    this.states.linearAttenuation = 0;
    this.states.quadraticAttenuation = 0;

    this.states._currentNormal = new Vector(0, 0, 1);

    this.states.drawMode = constants.FILL;

    this.states._tex = null;

    // erasing
    this._isErasing = false;

    // clipping
    this._clipDepths = [];
    this._isClipApplied = false;
    this._stencilTestOn = false;

    this.mixedAmbientLight = [];
    this.mixedSpecularColor = [];

    // p5.framebuffer for this are calculated in getDiffusedTexture function
    this.diffusedTextures = new Map();
    // p5.framebuffer for this are calculated in getSpecularTexture function
    this.specularTextures = new Map();

    this.preEraseBlend = undefined;
    this._cachedBlendMode = undefined;
    this._cachedFillStyle = [1, 1, 1, 1];
    this._cachedStrokeStyle = [0, 0, 0, 1];
    if (this.webglVersion === constants.WEBGL2) {
      this.blendExt = this.GL;
    } else {
      this.blendExt = this.GL.getExtension('EXT_blend_minmax');
    }
    this._isBlending = false;

    this._useLineColor = false;
    this._useVertexColor = false;

    this.registerEnabled = new Set();

    // Camera
    this.states.curCamera._computeCameraDefaultSettings();
    this.states.curCamera._setDefaultCamera();

    // FilterCamera
    this.filterCamera = new Camera(this);
    this.filterCamera._computeCameraDefaultSettings();
    this.filterCamera._setDefaultCamera();
    // Information about the previous frame's touch object
    // for executing orbitControl()
    this.prevTouches = [];
    // Velocity variable for use with orbitControl()
    this.zoomVelocity = 0;
    this.rotateVelocity = new Vector(0, 0);
    this.moveVelocity = new Vector(0, 0);
    // Flags for recording the state of zooming, rotation and moving
    this.executeZoom = false;
    this.executeRotateAndMove = false;

    this.states.specularShader = undefined;
    this.sphereMapping = undefined;
    this.states.diffusedShader = undefined;
    this._defaultLightShader = undefined;
    this._defaultImmediateModeShader = undefined;
    this._defaultNormalShader = undefined;
    this._defaultColorShader = undefined;
    this._defaultPointShader = undefined;

    this.states.userFillShader = undefined;
    this.states.userStrokeShader = undefined;
    this.states.userPointShader = undefined;

    this._useUserVertexProperties = undefined;

    // Default drawing is done in Retained Mode
    // Geometry and Material hashes stored here
    this.retainedMode = {
      geometry: {},
      buffers: {
        stroke: [
          new RenderBuffer(4, 'lineVertexColors', 'lineColorBuffer', 'aVertexColor', this),
          new RenderBuffer(3, 'lineVertices', 'lineVerticesBuffer', 'aPosition', this),
          new RenderBuffer(3, 'lineTangentsIn', 'lineTangentsInBuffer', 'aTangentIn', this),
          new RenderBuffer(3, 'lineTangentsOut', 'lineTangentsOutBuffer', 'aTangentOut', this),
          new RenderBuffer(1, 'lineSides', 'lineSidesBuffer', 'aSide', this)
        ],
        fill: [
          new RenderBuffer(3, 'vertices', 'vertexBuffer', 'aPosition', this, this._vToNArray),
          new RenderBuffer(3, 'vertexNormals', 'normalBuffer', 'aNormal', this, this._vToNArray),
          new RenderBuffer(4, 'vertexColors', 'colorBuffer', 'aVertexColor', this),
          new RenderBuffer(3, 'vertexAmbients', 'ambientBuffer', 'aAmbientColor', this),
          //new BufferDef(3, 'vertexSpeculars', 'specularBuffer', 'aSpecularColor'),
          new RenderBuffer(2, 'uvs', 'uvBuffer', 'aTexCoord', this, this._flatten)
        ],
        text: [
          new RenderBuffer(3, 'vertices', 'vertexBuffer', 'aPosition', this, this._vToNArray),
          new RenderBuffer(2, 'uvs', 'uvBuffer', 'aTexCoord', this, this._flatten)
        ],
        user:[]
      }
    };

    // Immediate Mode
    // Geometry and Material hashes stored here
    this.immediateMode = {
      geometry: new Geometry(),
      shapeMode: constants.TRIANGLE_FAN,
      contourIndices: [],
      _bezierVertex: [],
      _quadraticVertex: [],
      _curveVertex: [],
      buffers: {
        fill: [
          new RenderBuffer(3, 'vertices', 'vertexBuffer', 'aPosition', this, this._vToNArray),
          new RenderBuffer(3, 'vertexNormals', 'normalBuffer', 'aNormal', this, this._vToNArray),
          new RenderBuffer(4, 'vertexColors', 'colorBuffer', 'aVertexColor', this),
          new RenderBuffer(3, 'vertexAmbients', 'ambientBuffer', 'aAmbientColor', this),
          new RenderBuffer(2, 'uvs', 'uvBuffer', 'aTexCoord', this, this._flatten)
        ],
        stroke: [
          new RenderBuffer(4, 'lineVertexColors', 'lineColorBuffer', 'aVertexColor', this),
          new RenderBuffer(3, 'lineVertices', 'lineVerticesBuffer', 'aPosition', this),
          new RenderBuffer(3, 'lineTangentsIn', 'lineTangentsInBuffer', 'aTangentIn', this),
          new RenderBuffer(3, 'lineTangentsOut', 'lineTangentsOutBuffer', 'aTangentOut', this),
          new RenderBuffer(1, 'lineSides', 'lineSidesBuffer', 'aSide', this)
        ],
        point: this.GL.createBuffer(),
        user:[]
      }
    };

    this.pointSize = 5.0; //default point size
    this.curStrokeWeight = 1;
    this.curStrokeCap = constants.ROUND;
    this.curStrokeJoin = constants.ROUND;

    // map of texture sources to textures created in this gl context via this.getTexture(src)
    this.textures = new Map();

    // set of framebuffers in use
    this.framebuffers = new Set();
    // stack of active framebuffers
    this.activeFramebuffers = [];

    // for post processing step
    this.states.filterShader = undefined;
    this.filterLayer = undefined;
    this.filterLayerTemp = undefined;
    this.defaultFilterShaders = {};

    this.textureMode = constants.IMAGE;
    // default wrap settings
    this.textureWrapX = constants.CLAMP;
    this.textureWrapY = constants.CLAMP;
    this.states._tex = null;
    this._curveTightness = 6;

    // lookUpTable for coefficients needed to be calculated for bezierVertex, same are used for curveVertex
    this._lookUpTableBezier = [];
    // lookUpTable for coefficients needed to be calculated for quadraticVertex
    this._lookUpTableQuadratic = [];

    // current curveDetail in the Bezier lookUpTable
    this._lutBezierDetail = 0;
    // current curveDetail in the Quadratic lookUpTable
    this._lutQuadraticDetail = 0;

    // Used to distinguish between user calls to vertex() and internal calls
    this.isProcessingVertices = false;
    this._tessy = this._initTessy();

    this.fontInfos = {};

    this._curShader = undefined;
  }

  /**
    * Starts creating a new p5.Geometry. Subsequent shapes drawn will be added
     * to the geometry and then returned when
     * <a href="#/p5/endGeometry">endGeometry()</a> is called. One can also use
     * <a href="#/p5/buildGeometry">buildGeometry()</a> to pass a function that
     * draws shapes.
     *
     * If you need to draw complex shapes every frame which don't change over time,
     * combining them upfront with `beginGeometry()` and `endGeometry()` and then
     * drawing that will run faster than repeatedly drawing the individual pieces.
   */
  beginGeometry() {
    if (this.geometryBuilder) {
      throw new Error('It looks like `beginGeometry()` is being called while another p5.Geometry is already being build.');
    }
    this.geometryBuilder = new GeometryBuilder(this);
    this.geometryBuilder.prevFillColor = [...this.states.curFillColor];
    this.states.curFillColor = [-1, -1, -1, -1];
  }

  /**
   * Finishes creating a new <a href="#/p5.Geometry">p5.Geometry</a> that was
   * started using <a href="#/p5/beginGeometry">beginGeometry()</a>. One can also
   * use <a href="#/p5/buildGeometry">buildGeometry()</a> to pass a function that
   * draws shapes.
   *
   * @returns {p5.Geometry} The model that was built.
   */
  endGeometry() {
    if (!this.geometryBuilder) {
      throw new Error('Make sure you call beginGeometry() before endGeometry()!');
    }
    const geometry = this.geometryBuilder.finish();
    this.states.curFillColor = this.geometryBuilder.prevFillColor;
    this.geometryBuilder = undefined;
    return geometry;
  }

  /**
   * Creates a new <a href="#/p5.Geometry">p5.Geometry</a> that contains all
   * the shapes drawn in a provided callback function. The returned combined shape
   * can then be drawn all at once using <a href="#/p5/model">model()</a>.
   *
   * If you need to draw complex shapes every frame which don't change over time,
   * combining them with `buildGeometry()` once and then drawing that will run
   * faster than repeatedly drawing the individual pieces.
   *
   * One can also draw shapes directly between
   * <a href="#/p5/beginGeometry">beginGeometry()</a> and
   * <a href="#/p5/endGeometry">endGeometry()</a> instead of using a callback
   * function.
   * @param {Function} callback A function that draws shapes.
   * @returns {p5.Geometry} The model that was built from the callback function.
   */
  buildGeometry(callback) {
    this.beginGeometry();
    callback();
    return this.endGeometry();
  }

  //////////////////////////////////////////////
  // Setting
  //////////////////////////////////////////////

  _setAttributeDefaults(pInst) {
    // See issue #3850, safer to enable AA in Safari
    const applyAA = navigator.userAgent.toLowerCase().includes('safari');
    const defaults = {
      alpha: true,
      depth: true,
      stencil: true,
      antialias: applyAA,
      premultipliedAlpha: true,
      preserveDrawingBuffer: true,
      perPixelLighting: true,
      version: 2
    };
    if (pInst._glAttributes === null) {
      pInst._glAttributes = defaults;
    } else {
      pInst._glAttributes = Object.assign(defaults, pInst._glAttributes);
    }
    return;
  }

  _initContext() {
    if (this._pInst._glAttributes?.version !== 1) {
      // Unless WebGL1 is explicitly asked for, try to create a WebGL2 context
      this.drawingContext =
        this.canvas.getContext('webgl2', this._pInst._glAttributes);
    }
    this.webglVersion =
      this.drawingContext ? constants.WEBGL2 : constants.WEBGL;
    // If this is the main canvas, make sure the global `webglVersion` is set
    this._pInst.webglVersion = this.webglVersion;
    if (!this.drawingContext) {
      // If we were unable to create a WebGL2 context (either because it was
      // disabled via `setAttributes({ version: 1 })` or because the device
      // doesn't support it), fall back to a WebGL1 context
      this.drawingContext =
        this.canvas.getContext('webgl', this._pInst._glAttributes) ||
        this.canvas.getContext('experimental-webgl', this._pInst._glAttributes);
    }
    if (this.drawingContext === null) {
      throw new Error('Error creating webgl context');
    } else {
      const gl = this.drawingContext;
      gl.enable(gl.DEPTH_TEST);
      gl.depthFunc(gl.LEQUAL);
      gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
      // Make sure all images are loaded into the canvas premultiplied so that
      // they match the way we render colors. This will make framebuffer textures
      // be encoded the same way as textures from everything else.
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
      this._viewport = this.drawingContext.getParameter(
        this.drawingContext.VIEWPORT
      );
    }
  }

  _getMaxTextureSize() {
    const gl = this.drawingContext;
    return gl.getParameter(gl.MAX_TEXTURE_SIZE);
  }

  _adjustDimensions(width, height) {
    if (!this._maxTextureSize) {
      this._maxTextureSize = this._getMaxTextureSize();
    }
    let maxTextureSize = this._maxTextureSize;

    let maxAllowedPixelDimensions = Math.floor(
      maxTextureSize / this._pixelDensity
    );
    let adjustedWidth = Math.min(
      width, maxAllowedPixelDimensions
    );
    let adjustedHeight = Math.min(
      height, maxAllowedPixelDimensions
    );

    if (adjustedWidth !== width || adjustedHeight !== height) {
      console.warn(
        'Warning: The requested width/height exceeds hardware limits. ' +
          `Adjusting dimensions to width: ${adjustedWidth}, height: ${adjustedHeight}.`
      );
    }

    return { adjustedWidth, adjustedHeight };
  }

  //This is helper function to reset the context anytime the attributes
  //are changed with setAttributes()

  _resetContext(options, callback) {
    const w = this.width;
    const h = this.height;
    const defaultId = this.canvas.id;
    const isPGraphics = this._pInst instanceof p5.Graphics;

    if (isPGraphics) {
      const pg = this._pInst;
      pg.canvas.parentNode.removeChild(pg.canvas);
      pg.canvas = document.createElement('canvas');
      const node = pg._pInst._userNode || document.body;
      node.appendChild(pg.canvas);
      p5.Element.call(pg, pg.canvas, pg._pInst);
      pg.width = w;
      pg.height = h;
    } else {
      let c = this.canvas;
      if (c) {
        c.parentNode.removeChild(c);
      }
      c = document.createElement('canvas');
      c.id = defaultId;
      if (this._pInst._userNode) {
        this._pInst._userNode.appendChild(c);
      } else {
        document.body.appendChild(c);
      }
      this._pInst.canvas = c;
      this.canvas = c;
    }

    const renderer = new p5.RendererGL(
      this._pInst,
      w,
      h,
      !isPGraphics,
      this._pInst.canvas,
    );
    this._pInst._renderer = renderer;

    renderer._applyDefaults();

    if (typeof callback === 'function') {
      //setTimeout with 0 forces the task to the back of the queue, this ensures that
      //we finish switching out the renderer
      setTimeout(() => {
        callback.apply(window._renderer, options);
      }, 0);
    }
  }


  _update() {
    // reset model view and apply initial camera transform
    // (containing only look at info; no projection).
    this.states.uModelMatrix.reset();
    this.states.uViewMatrix.set(this.states.curCamera.cameraMatrix);

    // reset light data for new frame.

    this.states.ambientLightColors.length = 0;
    this.states.specularColors = [1, 1, 1];

    this.states.directionalLightDirections.length = 0;
    this.states.directionalLightDiffuseColors.length = 0;
    this.states.directionalLightSpecularColors.length = 0;

    this.states.pointLightPositions.length = 0;
    this.states.pointLightDiffuseColors.length = 0;
    this.states.pointLightSpecularColors.length = 0;

    this.states.spotLightPositions.length = 0;
    this.states.spotLightDirections.length = 0;
    this.states.spotLightDiffuseColors.length = 0;
    this.states.spotLightSpecularColors.length = 0;
    this.states.spotLightAngle.length = 0;
    this.states.spotLightConc.length = 0;

    this.states._enableLighting = false;

    //reset tint value for new frame
    this.states.tint = [255, 255, 255, 255];

    //Clear depth every frame
    this.GL.clearStencil(0);
    this.GL.clear(this.GL.DEPTH_BUFFER_BIT | this.GL.STENCIL_BUFFER_BIT);
    this.GL.disable(this.GL.STENCIL_TEST);
  }

  /**
 * [background description]
 */
  background(...args) {
    const _col = this._pInst.color(...args);
    const _r = _col.levels[0] / 255;
    const _g = _col.levels[1] / 255;
    const _b = _col.levels[2] / 255;
    const _a = _col.levels[3] / 255;
    this.clear(_r, _g, _b, _a);
  }

  //////////////////////////////////////////////
  // COLOR
  //////////////////////////////////////////////
  /**
 * Basic fill material for geometry with a given color
 * @param  {Number|Number[]|String|p5.Color} v1  gray value,
 * red or hue value (depending on the current color mode),
 * or color Array, or CSS color string
 * @param  {Number}            [v2] green or saturation value
 * @param  {Number}            [v3] blue or brightness value
 * @param  {Number}            [a]  opacity
 * @chainable
 * @example
 * <div>
 * <code>
 * function setup() {
 *   createCanvas(200, 200, WEBGL);
 * }
 *
 * function draw() {
 *   background(0);
 *   noStroke();
 *   fill(100, 100, 240);
 *   rotateX(frameCount * 0.01);
 *   rotateY(frameCount * 0.01);
 *   box(75, 75, 75);
 * }
 * </code>
 * </div>
 *
 * @alt
 * black canvas with purple cube spinning
 */
  fill(v1, v2, v3, a) {
    //see material.js for more info on color blending in webgl
    const color = fn.color.apply(this._pInst, arguments);
    this.states.curFillColor = color._array;
    this.states.drawMode = constants.FILL;
    this.states._useNormalMaterial = false;
    this.states._tex = null;
  }

  /**
 * Basic stroke material for geometry with a given color
 * @param  {Number|Number[]|String|p5.Color} v1  gray value,
 * red or hue value (depending on the current color mode),
 * or color Array, or CSS color string
 * @param  {Number}            [v2] green or saturation value
 * @param  {Number}            [v3] blue or brightness value
 * @param  {Number}            [a]  opacity
 * @example
 * <div>
 * <code>
 * function setup() {
 *   createCanvas(200, 200, WEBGL);
 * }
 *
 * function draw() {
 *   background(0);
 *   stroke(240, 150, 150);
 *   fill(100, 100, 240);
 *   rotateX(frameCount * 0.01);
 *   rotateY(frameCount * 0.01);
 *   box(75, 75, 75);
 * }
 * </code>
 * </div>
 *
 * @alt
 * black canvas with purple cube with pink outline spinning
 */
  stroke(r, g, b, a) {
    const color = fn.color.apply(this._pInst, arguments);
    this.states.curStrokeColor = color._array;
  }

  strokeCap(cap) {
    this.curStrokeCap = cap;
  }

  strokeJoin(join) {
    this.curStrokeJoin = join;
  }
  getFilterLayer() {
    if (!this.filterLayer) {
      this.filterLayer = this._pInst.createFramebuffer();
    }
    return this.filterLayer;
  }
  getFilterLayerTemp() {
    if (!this.filterLayerTemp) {
      this.filterLayerTemp = this._pInst.createFramebuffer();
    }
    return this.filterLayerTemp;
  }
  matchSize(fboToMatch, target) {
    if (
      fboToMatch.width !== target.width ||
      fboToMatch.height !== target.height
    ) {
      fboToMatch.resize(target.width, target.height);
    }

    if (fboToMatch.pixelDensity() !== target.pixelDensity()) {
      fboToMatch.pixelDensity(target.pixelDensity());
    }
  }
  filter(...args) {

    let fbo = this.getFilterLayer();

    // use internal shader for filter constants BLUR, INVERT, etc
    let filterParameter = undefined;
    let operation = undefined;
    if (typeof args[0] === 'string') {
      operation = args[0];
      let defaults = {
        [constants.BLUR]: 3,
        [constants.POSTERIZE]: 4,
        [constants.THRESHOLD]: 0.5
      };
      let useDefaultParam = operation in defaults && args[1] === undefined;
      filterParameter = useDefaultParam ? defaults[operation] : args[1];

      // Create and store shader for constants once on initial filter call.
      // Need to store multiple in case user calls different filters,
      // eg. filter(BLUR) then filter(GRAY)
      if (!(operation in this.defaultFilterShaders)) {
        this.defaultFilterShaders[operation] = new Shader(
          fbo._renderer,
          filterShaderVert,
          filterShaderFrags[operation]
        );
      }
      this.states.filterShader = this.defaultFilterShaders[operation];

    }
    // use custom user-supplied shader
    else {
      this.states.filterShader = args[0];
    }

    // Setting the target to the framebuffer when applying a filter to a framebuffer.

    const target = this.activeFramebuffer() || this;

    // Resize the framebuffer 'fbo' and adjust its pixel density if it doesn't match the target.
    this.matchSize(fbo, target);

    fbo.draw(() => this._pInst.clear()); // prevent undesirable feedback effects accumulating secretly.

    let texelSize = [
      1 / (target.width * target.pixelDensity()),
      1 / (target.height * target.pixelDensity())
    ];

    // apply blur shader with multiple passes.
    if (operation === constants.BLUR) {
      // Treating 'tmp' as a framebuffer.
      const tmp = this.getFilterLayerTemp();
      // Resize the framebuffer 'tmp' and adjust its pixel density if it doesn't match the target.
      this.matchSize(tmp, target);
      // setup
      this._pInst.push();
      this._pInst.noStroke();
      this._pInst.blendMode(constants.BLEND);

      // draw main to temp buffer
      this._pInst.shader(this.states.filterShader);
      this.states.filterShader.setUniform('texelSize', texelSize);
      this.states.filterShader.setUniform('canvasSize', [target.width, target.height]);
      this.states.filterShader.setUniform('radius', Math.max(1, filterParameter));

      // Horiz pass: draw `target` to `tmp`
      tmp.draw(() => {
        this.states.filterShader.setUniform('direction', [1, 0]);
        this.states.filterShader.setUniform('tex0', target);
        this._pInst.clear();
        this._pInst.shader(this.states.filterShader);
        this._pInst.noLights();
        this._pInst.plane(target.width, target.height);
      });

      // Vert pass: draw `tmp` to `fbo`
      fbo.draw(() => {
        this.states.filterShader.setUniform('direction', [0, 1]);
        this.states.filterShader.setUniform('tex0', tmp);
        this._pInst.clear();
        this._pInst.shader(this.states.filterShader);
        this._pInst.noLights();
        this._pInst.plane(target.width, target.height);
      });

      this._pInst.pop();
    }
    // every other non-blur shader uses single pass
    else {
      fbo.draw(() => {
        this._pInst.noStroke();
        this._pInst.blendMode(constants.BLEND);
        this._pInst.shader(this.states.filterShader);
        this.states.filterShader.setUniform('tex0', target);
        this.states.filterShader.setUniform('texelSize', texelSize);
        this.states.filterShader.setUniform('canvasSize', [target.width, target.height]);
        // filterParameter uniform only used for POSTERIZE, and THRESHOLD
        // but shouldn't hurt to always set
        this.states.filterShader.setUniform('filterParameter', filterParameter);
        this._pInst.noLights();
        this._pInst.plane(target.width, target.height);
      });

    }
    // draw fbo contents onto main renderer.
    this._pInst.push();
    this._pInst.noStroke();
    this.clear();
    this._pInst.push();
    this._pInst.imageMode(constants.CORNER);
    this._pInst.blendMode(constants.BLEND);
    target.filterCamera._resize();
    this._pInst.setCamera(target.filterCamera);
    this._pInst.resetMatrix();
    this._pInst.image(fbo, -target.width / 2, -target.height / 2,
      target.width, target.height);
    this._pInst.clearDepth();
    this._pInst.pop();
    this._pInst.pop();
  }

  // Pass this off to the host instance so that we can treat a renderer and a
  // framebuffer the same in filter()

  pixelDensity(newDensity) {
    if (newDensity) {
      return this._pInst.pixelDensity(newDensity);
    }
    return this._pInst.pixelDensity();
  }

  blendMode(mode) {
    if (
      mode === constants.DARKEST ||
      mode === constants.LIGHTEST ||
      mode === constants.ADD ||
      mode === constants.BLEND ||
      mode === constants.SUBTRACT ||
      mode === constants.SCREEN ||
      mode === constants.EXCLUSION ||
      mode === constants.REPLACE ||
      mode === constants.MULTIPLY ||
      mode === constants.REMOVE
    )
      this.states.curBlendMode = mode;
    else if (
      mode === constants.BURN ||
      mode === constants.OVERLAY ||
      mode === constants.HARD_LIGHT ||
      mode === constants.SOFT_LIGHT ||
      mode === constants.DODGE
    ) {
      console.warn(
        'BURN, OVERLAY, HARD_LIGHT, SOFT_LIGHT, and DODGE only work for blendMode in 2D mode.'
      );
    }
  }

  erase(opacityFill, opacityStroke) {
    if (!this._isErasing) {
      this.preEraseBlend = this.states.curBlendMode;
      this._isErasing = true;
      this.blendMode(constants.REMOVE);
      this._cachedFillStyle = this.states.curFillColor.slice();
      this.states.curFillColor = [1, 1, 1, opacityFill / 255];
      this._cachedStrokeStyle = this.states.curStrokeColor.slice();
      this.states.curStrokeColor = [1, 1, 1, opacityStroke / 255];
    }
  }

  noErase() {
    if (this._isErasing) {
      // Restore colors
      this.states.curFillColor = this._cachedFillStyle.slice();
      this.states.curStrokeColor = this._cachedStrokeStyle.slice();
      // Restore blend mode
      this.states.curBlendMode = this.preEraseBlend;
      this.blendMode(this.preEraseBlend);
      // Ensure that _applyBlendMode() sets preEraseBlend back to the original blend mode
      this._isErasing = false;
      this._applyBlendMode();
    }
  }

  drawTarget() {
    return this.activeFramebuffers[this.activeFramebuffers.length - 1] || this;
  }

  beginClip(options = {}) {
    super.beginClip(options);

    this.drawTarget()._isClipApplied = true;

    const gl = this.GL;
    gl.clearStencil(0);
    gl.clear(gl.STENCIL_BUFFER_BIT);
    gl.enable(gl.STENCIL_TEST);
    this._stencilTestOn = true;
    gl.stencilFunc(
      gl.ALWAYS, // the test
      1, // reference value
      0xff // mask
    );
    gl.stencilOp(
      gl.KEEP, // what to do if the stencil test fails
      gl.KEEP, // what to do if the depth test fails
      gl.REPLACE // what to do if both tests pass
    );
    gl.disable(gl.DEPTH_TEST);

    this._pInst.push();
    this._pInst.resetShader();
    if (this.states.doFill) this._pInst.fill(0, 0);
    if (this.states.doStroke) this._pInst.stroke(0, 0);
  }

  endClip() {
    this._pInst.pop();

    const gl = this.GL;
    gl.stencilOp(
      gl.KEEP, // what to do if the stencil test fails
      gl.KEEP, // what to do if the depth test fails
      gl.KEEP // what to do if both tests pass
    );
    gl.stencilFunc(
      this._clipInvert ? gl.EQUAL : gl.NOTEQUAL, // the test
      0, // reference value
      0xff // mask
    );
    gl.enable(gl.DEPTH_TEST);

    // Mark the depth at which the clip has been applied so that we can clear it
    // when we pop past this depth
    this._clipDepths.push(this._pushPopDepth);

    super.endClip();
  }

  _clearClip() {
    this.GL.clearStencil(1);
    this.GL.clear(this.GL.STENCIL_BUFFER_BIT);
    if (this._clipDepths.length > 0) {
      this._clipDepths.pop();
    }
    this.drawTarget()._isClipApplied = false;
  }

  /**
 * Change weight of stroke
 * @param  {Number} stroke weight to be used for drawing
 * @example
 * <div>
 * <code>
 * function setup() {
 *   createCanvas(200, 400, WEBGL);
 *   setAttributes('antialias', true);
 * }
 *
 * function draw() {
 *   background(0);
 *   noStroke();
 *   translate(0, -100, 0);
 *   stroke(240, 150, 150);
 *   fill(100, 100, 240);
 *   push();
 *   strokeWeight(8);
 *   rotateX(frameCount * 0.01);
 *   rotateY(frameCount * 0.01);
 *   sphere(75);
 *   pop();
 *   push();
 *   translate(0, 200, 0);
 *   strokeWeight(1);
 *   rotateX(frameCount * 0.01);
 *   rotateY(frameCount * 0.01);
 *   sphere(75);
 *   pop();
 * }
 * </code>
 * </div>
 *
 * @alt
 * black canvas with two purple rotating spheres with pink
 * outlines the sphere on top has much heavier outlines,
 */
  strokeWeight(w) {
    if (this.curStrokeWeight !== w) {
      this.pointSize = w;
      this.curStrokeWeight = w;
    }
  }

  // x,y are canvas-relative (pre-scaled by _pixelDensity)
  _getPixel(x, y) {
    const gl = this.GL;
    return readPixelWebGL(
      gl,
      null,
      x,
      y,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      this._pInst.height * this._pInst.pixelDensity()
    );
  }

  /**
 * Loads the pixels data for this canvas into the pixels[] attribute.
 * Note that updatePixels() and set() do not work.
 * Any pixel manipulation must be done directly to the pixels[] array.
 *
 * @private
 */

  loadPixels() {
    const pixelsState = this._pixelsState;

    //@todo_FES
    if (this._pInst._glAttributes.preserveDrawingBuffer !== true) {
      console.log(
        'loadPixels only works in WebGL when preserveDrawingBuffer ' + 'is true.'
      );
      return;
    }

    const pd = this._pixelDensity;
    const gl = this.GL;

    pixelsState.pixels =
      readPixelsWebGL(
        pixelsState.pixels,
        gl,
        null,
        0,
        0,
        this.width * pd,
        this.height * pd,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        this.height * pd
      );
  }

  updatePixels() {
    const fbo = this._getTempFramebuffer();
    fbo.pixels = this._pixelsState.pixels;
    fbo.updatePixels();
    this._pInst.push();
    this._pInst.resetMatrix();
    this._pInst.clear();
    this._pInst.imageMode(constants.CENTER);
    this._pInst.image(fbo, 0, 0);
    this._pInst.pop();
    this.GL.clearDepth(1);
    this.GL.clear(this.GL.DEPTH_BUFFER_BIT);
  }

  /**
 * @private
 * @returns {p5.Framebuffer} A p5.Framebuffer set to match the size and settings
 * of the renderer's canvas. It will be created if it does not yet exist, and
 * reused if it does.
 */
  _getTempFramebuffer() {
    if (!this._tempFramebuffer) {
      this._tempFramebuffer = this._pInst.createFramebuffer({
        format: constants.UNSIGNED_BYTE,
        useDepth: this._pInst._glAttributes.depth,
        depthFormat: constants.UNSIGNED_INT,
        antialias: this._pInst._glAttributes.antialias
      });
    }
    return this._tempFramebuffer;
  }



  //////////////////////////////////////////////
  // HASH | for geometry
  //////////////////////////////////////////////

  geometryInHash(gId) {
    return this.retainedMode.geometry[gId] !== undefined;
  }

  viewport(w, h) {
    this._viewport = [0, 0, w, h];
    this.GL.viewport(0, 0, w, h);
  }

  /**
 * [resize description]
 * @private
 * @param  {Number} w [description]
 * @param  {Number} h [description]
 */
  resize(w, h) {
    super.resize(w, h);

    // save canvas properties
    const props = {};
    for (const key in this.drawingContext) {
      const val = this.drawingContext[key];
      if (typeof val !== 'object' && typeof val !== 'function') {
        props[key] = val;
      }
    }

    const dimensions = this._adjustDimensions(w, h);
    w = dimensions.adjustedWidth;
    h = dimensions.adjustedHeight;

    this.width = w;
    this.height = h;

    this.canvas.width = w * this._pixelDensity;
    this.canvas.height = h * this._pixelDensity;
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    this._origViewport = {
      width: this.GL.drawingBufferWidth,
      height: this.GL.drawingBufferHeight
    };
    this.viewport(
      this._origViewport.width,
      this._origViewport.height
    );

    this.states.curCamera._resize();

    //resize pixels buffer
    const pixelsState = this._pixelsState;
    if (typeof pixelsState.pixels !== 'undefined') {
      pixelsState.pixels =
        new Uint8Array(
          this.GL.drawingBufferWidth * this.GL.drawingBufferHeight * 4
        );
    }

    for (const framebuffer of this.framebuffers) {
      // Notify framebuffers of the resize so that any auto-sized framebuffers
      // can also update their size
      framebuffer._canvasSizeChanged();
    }

    // reset canvas properties
    for (const savedKey in props) {
      try {
        this.drawingContext[savedKey] = props[savedKey];
      } catch (err) {
        // ignore read-only property errors
      }
    }
  }

  /**
 * clears color and depth buffers
 * with r,g,b,a
 * @private
 * @param {Number} r normalized red val.
 * @param {Number} g normalized green val.
 * @param {Number} b normalized blue val.
 * @param {Number} a normalized alpha val.
 */
  clear(...args) {
    const _r = args[0] || 0;
    const _g = args[1] || 0;
    const _b = args[2] || 0;
    let _a = args[3] || 0;

    const activeFramebuffer = this.activeFramebuffer();
    if (
      activeFramebuffer &&
      activeFramebuffer.format === constants.UNSIGNED_BYTE &&
      !activeFramebuffer.antialias &&
      _a === 0
    ) {
      // Drivers on Intel Macs check for 0,0,0,0 exactly when drawing to a
      // framebuffer and ignore the command if it's the only drawing command to
      // the framebuffer. To work around it, we can set the alpha to a value so
      // low that it still rounds down to 0, but that circumvents the buggy
      // check in the driver.
      _a = 1e-10;
    }

    this.GL.clearColor(_r * _a, _g * _a, _b * _a, _a);
    this.GL.clearDepth(1);
    this.GL.clear(this.GL.COLOR_BUFFER_BIT | this.GL.DEPTH_BUFFER_BIT);
  }

  /**
   * Resets all depth information so that nothing previously drawn will
   * occlude anything subsequently drawn.
   */
  clearDepth(depth = 1) {
    this.GL.clearDepth(depth);
    this.GL.clear(this.GL.DEPTH_BUFFER_BIT);
  }

  applyMatrix(a, b, c, d, e, f) {
    if (arguments.length === 16) {
      Matrix.prototype.apply.apply(this.states.uModelMatrix, arguments);
    } else {
      this.states.uModelMatrix.apply([
        a, b, 0, 0,
        c, d, 0, 0,
        0, 0, 1, 0,
        e, f, 0, 1
      ]);
    }
  }

  /**
 * [translate description]
 * @private
 * @param  {Number} x [description]
 * @param  {Number} y [description]
 * @param  {Number} z [description]
 * @chainable
 * @todo implement handle for components or vector as args
 */
  translate(x, y, z) {
    if (x instanceof Vector) {
      z = x.z;
      y = x.y;
      x = x.x;
    }
    this.states.uModelMatrix.translate([x, y, z]);
    return this;
  }

  /**
 * Scales the Model View Matrix by a vector
 * @private
 * @param  {Number | p5.Vector | Array} x [description]
 * @param  {Number} [y] y-axis scalar
 * @param  {Number} [z] z-axis scalar
 * @chainable
 */
  scale(x, y, z) {
    this.states.uModelMatrix.scale(x, y, z);
    return this;
  }

  rotate(rad, axis) {
    if (typeof axis === 'undefined') {
      return this.rotateZ(rad);
    }
    Matrix.prototype.rotate.apply(this.states.uModelMatrix, arguments);
    return this;
  }

  rotateX(rad) {
    this.rotate(rad, 1, 0, 0);
    return this;
  }

  rotateY(rad) {
    this.rotate(rad, 0, 1, 0);
    return this;
  }

  rotateZ(rad) {
    this.rotate(rad, 0, 0, 1);
    return this;
  }

  pop(...args) {
    if (
      this._clipDepths.length > 0 &&
      this._pushPopDepth === this._clipDepths[this._clipDepths.length - 1]
    ) {
      this._clearClip();
    }
    super.pop(...args);
    this._applyStencilTestIfClipping();
  }
  _applyStencilTestIfClipping() {
    const drawTarget = this.drawTarget();
    if (drawTarget._isClipApplied !== this._stencilTestOn) {
      if (drawTarget._isClipApplied) {
        this.GL.enable(this.GL.STENCIL_TEST);
        this._stencilTestOn = true;
      } else {
        this.GL.disable(this.GL.STENCIL_TEST);
        this._stencilTestOn = false;
      }
    }
  }
  resetMatrix() {
    this.states.uModelMatrix.reset();
    this.states.uViewMatrix.set(this.states.curCamera.cameraMatrix);
    return this;
  }

  //////////////////////////////////////////////
  // SHADER
  //////////////////////////////////////////////

  /*
 * shaders are created and cached on a per-renderer basis,
 * on the grounds that each renderer will have its own gl context
 * and the shader must be valid in that context.
 */

  _getImmediateStrokeShader() {
    // select the stroke shader to use
    const stroke = this.states.userStrokeShader;
    if (!stroke || !stroke.isStrokeShader()) {
      return this._getLineShader();
    }
    return stroke;
  }


  _getRetainedStrokeShader() {
    return this._getImmediateStrokeShader();
  }

  _getSphereMapping(img) {
    if (!this.sphereMapping) {
      this.sphereMapping = this._pInst.createFilterShader(
        sphereMapping
      );
    }
    this.states.uNMatrix.inverseTranspose(this.states.uViewMatrix);
    this.states.uNMatrix.invert3x3(this.states.uNMatrix);
    this.sphereMapping.setUniform('uFovY', this.states.curCamera.cameraFOV);
    this.sphereMapping.setUniform('uAspect', this.states.curCamera.aspectRatio);
    this.sphereMapping.setUniform('uNewNormalMatrix', this.states.uNMatrix.mat3);
    this.sphereMapping.setUniform('uSampler', img);
    return this.sphereMapping;
  }

  /*
   * selects which fill shader should be used based on renderer state,
   * for use with begin/endShape and immediate vertex mode.
   */
  _getImmediateFillShader() {
    const fill = this.states.userFillShader;
    if (this.states._useNormalMaterial) {
      if (!fill || !fill.isNormalShader()) {
        return this._getNormalShader();
      }
    }
    if (this.states._enableLighting) {
      if (!fill || !fill.isLightShader()) {
        return this._getLightShader();
      }
    } else if (this.states._tex) {
      if (!fill || !fill.isTextureShader()) {
        return this._getLightShader();
      }
    } else if (!fill /*|| !fill.isColorShader()*/) {
      return this._getImmediateModeShader();
    }
    return fill;
  }

  /*
   * selects which fill shader should be used based on renderer state
   * for retained mode.
   */
  _getRetainedFillShader() {
    if (this.states._useNormalMaterial) {
      return this._getNormalShader();
    }

    const fill = this.states.userFillShader;
    if (this.states._enableLighting) {
      if (!fill || !fill.isLightShader()) {
        return this._getLightShader();
      }
    } else if (this.states._tex) {
      if (!fill || !fill.isTextureShader()) {
        return this._getLightShader();
      }
    } else if (!fill /* || !fill.isColorShader()*/) {
      return this._getColorShader();
    }
    return fill;
  }

  _getImmediatePointShader() {
    // select the point shader to use
    const point = this.states.userPointShader;
    if (!point || !point.isPointShader()) {
      return this._getPointShader();
    }
    return point;
  }

  _getRetainedLineShader() {
    return this._getImmediateLineShader();
  }

  baseMaterialShader() {
    if (!this._pInst._glAttributes.perPixelLighting) {
      throw new Error(
        'The material shader does not support hooks without perPixelLighting. Try turning it back on.'
      );
    }
    return this._getLightShader();
  }

  _getLightShader() {
    if (!this._defaultLightShader) {
      if (this._pInst._glAttributes.perPixelLighting) {
        this._defaultLightShader = new Shader(
          this,
          this._webGL2CompatibilityPrefix('vert', 'highp') +
          defaultShaders.phongVert,
          this._webGL2CompatibilityPrefix('frag', 'highp') +
          defaultShaders.phongFrag,
          {
            vertex: {
              'void beforeVertex': '() {}',
              'vec3 getLocalPosition': '(vec3 position) { return position; }',
              'vec3 getWorldPosition': '(vec3 position) { return position; }',
              'vec3 getLocalNormal': '(vec3 normal) { return normal; }',
              'vec3 getWorldNormal': '(vec3 normal) { return normal; }',
              'vec2 getUV': '(vec2 uv) { return uv; }',
              'vec4 getVertexColor': '(vec4 color) { return color; }',
              'void afterVertex': '() {}'
            },
            fragment: {
              'void beforeFragment': '() {}',
              'Inputs getPixelInputs': '(Inputs inputs) { return inputs; }',
              'vec4 combineColors': `(ColorComponents components) {
                vec4 color = vec4(0.);
                color.rgb += components.diffuse * components.baseColor;
                color.rgb += components.ambient * components.ambientColor;
                color.rgb += components.specular * components.specularColor;
                color.rgb += components.emissive;
                color.a = components.opacity;
                return color;
              }`,
              'vec4 getFinalColor': '(vec4 color) { return color; }',
              'void afterFragment': '() {}'
            }
          }
        );
      } else {
        this._defaultLightShader = new Shader(
          this,
          this._webGL2CompatibilityPrefix('vert', 'highp') +
          defaultShaders.lightVert,
          this._webGL2CompatibilityPrefix('frag', 'highp') +
          defaultShaders.lightTextureFrag
        );
      }
    }

    return this._defaultLightShader;
  }

  _getImmediateModeShader() {
    if (!this._defaultImmediateModeShader) {
      this._defaultImmediateModeShader = new Shader(
        this,
        this._webGL2CompatibilityPrefix('vert', 'mediump') +
        defaultShaders.immediateVert,
        this._webGL2CompatibilityPrefix('frag', 'mediump') +
        defaultShaders.vertexColorFrag
      );
    }

    return this._defaultImmediateModeShader;
  }

  baseNormalShader() {
    return this._getNormalShader();
  }

  _getNormalShader() {
    if (!this._defaultNormalShader) {
      this._defaultNormalShader = new Shader(
        this,
        this._webGL2CompatibilityPrefix('vert', 'mediump') +
        defaultShaders.normalVert,
        this._webGL2CompatibilityPrefix('frag', 'mediump') +
        defaultShaders.normalFrag,
        {
          vertex: {
            'void beforeVertex': '() {}',
            'vec3 getLocalPosition': '(vec3 position) { return position; }',
            'vec3 getWorldPosition': '(vec3 position) { return position; }',
            'vec3 getLocalNormal': '(vec3 normal) { return normal; }',
            'vec3 getWorldNormal': '(vec3 normal) { return normal; }',
            'vec2 getUV': '(vec2 uv) { return uv; }',
            'vec4 getVertexColor': '(vec4 color) { return color; }',
            'void afterVertex': '() {}'
          },
          fragment: {
            'void beforeFragment': '() {}',
            'vec4 getFinalColor': '(vec4 color) { return color; }',
            'void afterFragment': '() {}'
          }
        }
      );
    }

    return this._defaultNormalShader;
  }

  baseColorShader() {
    return this._getColorShader();
  }

  _getColorShader() {
    if (!this._defaultColorShader) {
      this._defaultColorShader = new Shader(
        this,
        this._webGL2CompatibilityPrefix('vert', 'mediump') +
        defaultShaders.normalVert,
        this._webGL2CompatibilityPrefix('frag', 'mediump') +
        defaultShaders.basicFrag,
        {
          vertex: {
            'void beforeVertex': '() {}',
            'vec3 getLocalPosition': '(vec3 position) { return position; }',
            'vec3 getWorldPosition': '(vec3 position) { return position; }',
            'vec3 getLocalNormal': '(vec3 normal) { return normal; }',
            'vec3 getWorldNormal': '(vec3 normal) { return normal; }',
            'vec2 getUV': '(vec2 uv) { return uv; }',
            'vec4 getVertexColor': '(vec4 color) { return color; }',
            'void afterVertex': '() {}'
          },
          fragment: {
            'void beforeFragment': '() {}',
            'vec4 getFinalColor': '(vec4 color) { return color; }',
            'void afterFragment': '() {}'
          }
        }
      );
    }

    return this._defaultColorShader;
  }

  /**
   * TODO(dave): un-private this when there is a way to actually override the
   * shader used for points
   *
   * Get the shader used when drawing points with <a href="#/p5/point">`point()`</a>.
   *
   * You can call <a href="#/p5.Shader/modify">`pointShader().modify()`</a>
   * and change any of the following hooks:
   * - `void beforeVertex`: Called at the start of the vertex shader.
   * - `vec3 getLocalPosition`: Update the position of vertices before transforms are applied. It takes in `vec3 position` and must return a modified version.
   * - `vec3 getWorldPosition`: Update the position of vertices after transforms are applied. It takes in `vec3 position` and pust return a modified version.
   * - `float getPointSize`: Update the size of the point. It takes in `float size` and must return a modified version.
   * - `void afterVertex`: Called at the end of the vertex shader.
   * - `void beforeFragment`: Called at the start of the fragment shader.
   * - `bool shouldDiscard`: Points are drawn inside a square, with the corners discarded in the fragment shader to create a circle. Use this to change this logic. It takes in a `bool willDiscard` and must return a modified version.
   * - `vec4 getFinalColor`: Update the final color after mixing. It takes in a `vec4 color` and must return a modified version.
   * - `void afterFragment`: Called at the end of the fragment shader.
   *
   * Call `pointShader().inspectHooks()` to see all the possible hooks and
   * their default implementations.
   *
   * @returns {p5.Shader} The `point()` shader
   * @private()
   */
  pointShader() {
    return this._getPointShader();
  }

  _getPointShader() {
    if (!this._defaultPointShader) {
      this._defaultPointShader = new Shader(
        this,
        this._webGL2CompatibilityPrefix('vert', 'mediump') +
        defaultShaders.pointVert,
        this._webGL2CompatibilityPrefix('frag', 'mediump') +
        defaultShaders.pointFrag,
        {
          vertex: {
            'void beforeVertex': '() {}',
            'vec3 getLocalPosition': '(vec3 position) { return position; }',
            'vec3 getWorldPosition': '(vec3 position) { return position; }',
            'float getPointSize': '(float size) { return size; }',
            'void afterVertex': '() {}'
          },
          fragment: {
            'void beforeFragment': '() {}',
            'vec4 getFinalColor': '(vec4 color) { return color; }',
            'bool shouldDiscard': '(bool outside) { return outside; }',
            'void afterFragment': '() {}'
          }
        }
      );
    }
    return this._defaultPointShader;
  }

  baseStrokeShader() {
    return this._getLineShader();
  }

  _getLineShader() {
    if (!this._defaultLineShader) {
      this._defaultLineShader = new Shader(
        this,
        this._webGL2CompatibilityPrefix('vert', 'mediump') +
        defaultShaders.lineVert,
        this._webGL2CompatibilityPrefix('frag', 'mediump') +
        defaultShaders.lineFrag,
        {
          vertex: {
            'void beforeVertex': '() {}',
            'vec3 getLocalPosition': '(vec3 position) { return position; }',
            'vec3 getWorldPosition': '(vec3 position) { return position; }',
            'float getStrokeWeight': '(float weight) { return weight; }',
            'vec2 getLineCenter': '(vec2 center) { return center; }',
            'vec2 getLinePosition': '(vec2 position) { return position; }',
            'vec4 getVertexColor': '(vec4 color) { return color; }',
            'void afterVertex': '() {}'
          },
          fragment: {
            'void beforeFragment': '() {}',
            'Inputs getPixelInputs': '(Inputs inputs) { return inputs; }',
            'vec4 getFinalColor': '(vec4 color) { return color; }',
            'bool shouldDiscard': '(bool outside) { return outside; }',
            'void afterFragment': '() {}'
          }
        }
      );
    }

    return this._defaultLineShader;
  }

  _getFontShader() {
    if (!this._defaultFontShader) {
      if (this.webglVersion === constants.WEBGL) {
        this.GL.getExtension('OES_standard_derivatives');
      }
      this._defaultFontShader = new Shader(
        this,
        this._webGL2CompatibilityPrefix('vert', 'mediump') +
        defaultShaders.fontVert,
        this._webGL2CompatibilityPrefix('frag', 'mediump') +
        defaultShaders.fontFrag
      );
    }
    return this._defaultFontShader;
  }

  _webGL2CompatibilityPrefix(
    shaderType,
    floatPrecision
  ) {
    let code = '';
    if (this.webglVersion === constants.WEBGL2) {
      code += '#version 300 es\n#define WEBGL2\n';
    }
    if (shaderType === 'vert') {
      code += '#define VERTEX_SHADER\n';
    } else if (shaderType === 'frag') {
      code += '#define FRAGMENT_SHADER\n';
    }
    if (floatPrecision) {
      code += `precision ${floatPrecision} float;\n`;
    }
    return code;
  }

  _getEmptyTexture() {
    if (!this._emptyTexture) {
      // a plain white texture RGBA, full alpha, single pixel.
      const im = new Image(1, 1);
      im.set(0, 0, 255);
      this._emptyTexture = new Texture(this, im);
    }
    return this._emptyTexture;
  }

  getTexture(input) {
    let src = input;
    if (src instanceof p5.Framebuffer) {
      src = src.color;
    }

    const texture = this.textures.get(src);
    if (texture) {
      return texture;
    }

    const tex = new Texture(this, src);
    this.textures.set(src, tex);
    return tex;
  }
  /*
    *  used in imageLight,
    *  To create a blurry image from the input non blurry img, if it doesn't already exist
    *  Add it to the diffusedTexture map,
    *  Returns the blurry image
    *  maps a Image used by imageLight() to a p5.Framebuffer
   */
  getDiffusedTexture(input) {
    // if one already exists for a given input image
    if (this.diffusedTextures.get(input) != null) {
      return this.diffusedTextures.get(input);
    }
    // if not, only then create one
    let newFramebuffer;
    // hardcoded to 200px, because it's going to be blurry and smooth
    let smallWidth = 200;
    let width = smallWidth;
    let height = Math.floor(smallWidth * (input.height / input.width));
    newFramebuffer = this._pInst.createFramebuffer({
      width, height, density: 1
    });
    // create framebuffer is like making a new sketch, all functions on main
    // sketch it would be available on framebuffer
    if (!this.states.diffusedShader) {
      this.states.diffusedShader = this._pInst.createShader(
        defaultShaders.imageLightVert,
        defaultShaders.imageLightDiffusedFrag
      );
    }
    newFramebuffer.draw(() => {
      this._pInst.shader(this.states.diffusedShader);
      this.states.diffusedShader.setUniform('environmentMap', input);
      this._pInst.noStroke();
      this._pInst.rectMode(constants.CENTER);
      this._pInst.noLights();
      this._pInst.rect(0, 0, width, height);
    });
    this.diffusedTextures.set(input, newFramebuffer);
    return newFramebuffer;
  }

  /*
   *  used in imageLight,
   *  To create a texture from the input non blurry image, if it doesn't already exist
   *  Creating 8 different levels of textures according to different
   *  sizes and atoring them in `levels` array
   *  Creating a new Mipmap texture with that `levels` array
   *  Storing the texture for input image in map called `specularTextures`
   *  maps the input Image to a p5.MipmapTexture
   */
  getSpecularTexture(input) {
    // check if already exits (there are tex of diff resolution so which one to check)
    // currently doing the whole array
    if (this.specularTextures.get(input) != null) {
      return this.specularTextures.get(input);
    }
    // Hardcoded size
    const size = 512;
    let tex;
    const levels = [];
    const framebuffer = this._pInst.createFramebuffer({
      width: size, height: size, density: 1
    });
    let count = Math.log(size) / Math.log(2);
    if (!this.states.specularShader) {
      this.states.specularShader = this._pInst.createShader(
        defaultShaders.imageLightVert,
        defaultShaders.imageLightSpecularFrag
      );
    }
    // currently only 8 levels
    // This loop calculates 8 framebuffers of varying size of canvas
    // and corresponding different roughness levels.
    // Roughness increases with the decrease in canvas size,
    // because rougher surfaces have less detailed/more blurry reflections.
    for (let w = size; w >= 1; w /= 2) {
      framebuffer.resize(w, w);
      let currCount = Math.log(w) / Math.log(2);
      let roughness = 1 - currCount / count;
      framebuffer.draw(() => {
        this._pInst.shader(this.states.specularShader);
        this._pInst.clear();
        this.states.specularShader.setUniform('environmentMap', input);
        this.states.specularShader.setUniform('roughness', roughness);
        this._pInst.noStroke();
        this._pInst.noLights();
        this._pInst.plane(w, w);
      });
      levels.push(framebuffer.get().drawingContext.getImageData(0, 0, w, w));
    }
    // Free the Framebuffer
    framebuffer.remove();
    tex = new p5.MipmapTexture(this, levels, {});
    this.specularTextures.set(input, tex);
    return tex;
  }

  /**
   * @private
   * @returns {p5.Framebuffer|null} The currently active framebuffer, or null if
   * the main canvas is the current draw target.
   */
  activeFramebuffer() {
    return this.activeFramebuffers[this.activeFramebuffers.length - 1] || null;
  }

  createFramebuffer(options) {
    return new p5.Framebuffer(this, options);
  }

  _setStrokeUniforms(baseStrokeShader) {
    baseStrokeShader.bindShader();

    // set the uniform values
    baseStrokeShader.setUniform('uUseLineColor', this._useLineColor);
    baseStrokeShader.setUniform('uMaterialColor', this.states.curStrokeColor);
    baseStrokeShader.setUniform('uStrokeWeight', this.curStrokeWeight);
    baseStrokeShader.setUniform('uStrokeCap', STROKE_CAP_ENUM[this.curStrokeCap]);
    baseStrokeShader.setUniform('uStrokeJoin', STROKE_JOIN_ENUM[this.curStrokeJoin]);
  }

  _setFillUniforms(fillShader) {
    fillShader.bindShader();

    this.mixedSpecularColor = [...this.states.curSpecularColor];

    if (this.states._useMetalness > 0) {
      this.mixedSpecularColor = this.mixedSpecularColor.map(
        (mixedSpecularColor, index) =>
          this.states.curFillColor[index] * this.states._useMetalness +
          mixedSpecularColor * (1 - this.states._useMetalness)
      );
    }

    // TODO: optimize
    fillShader.setUniform('uUseVertexColor', this._useVertexColor);
    fillShader.setUniform('uMaterialColor', this.states.curFillColor);
    fillShader.setUniform('isTexture', !!this.states._tex);
    if (this.states._tex) {
      fillShader.setUniform('uSampler', this.states._tex);
    }
    fillShader.setUniform('uTint', this.states.tint);

    fillShader.setUniform('uHasSetAmbient', this.states._hasSetAmbient);
    fillShader.setUniform('uAmbientMatColor', this.states.curAmbientColor);
    fillShader.setUniform('uSpecularMatColor', this.mixedSpecularColor);
    fillShader.setUniform('uEmissiveMatColor', this.states.curEmissiveColor);
    fillShader.setUniform('uSpecular', this.states._useSpecularMaterial);
    fillShader.setUniform('uEmissive', this.states._useEmissiveMaterial);
    fillShader.setUniform('uShininess', this.states._useShininess);
    fillShader.setUniform('uMetallic', this.states._useMetalness);

    this._setImageLightUniforms(fillShader);

    fillShader.setUniform('uUseLighting', this.states._enableLighting);

    const pointLightCount = this.states.pointLightDiffuseColors.length / 3;
    fillShader.setUniform('uPointLightCount', pointLightCount);
    fillShader.setUniform('uPointLightLocation', this.states.pointLightPositions);
    fillShader.setUniform(
      'uPointLightDiffuseColors',
      this.states.pointLightDiffuseColors
    );
    fillShader.setUniform(
      'uPointLightSpecularColors',
      this.states.pointLightSpecularColors
    );

    const directionalLightCount = this.states.directionalLightDiffuseColors.length / 3;
    fillShader.setUniform('uDirectionalLightCount', directionalLightCount);
    fillShader.setUniform('uLightingDirection', this.states.directionalLightDirections);
    fillShader.setUniform(
      'uDirectionalDiffuseColors',
      this.states.directionalLightDiffuseColors
    );
    fillShader.setUniform(
      'uDirectionalSpecularColors',
      this.states.directionalLightSpecularColors
    );

    // TODO: sum these here...
    const ambientLightCount = this.states.ambientLightColors.length / 3;
    this.mixedAmbientLight = [...this.states.ambientLightColors];

    if (this.states._useMetalness > 0) {
      this.mixedAmbientLight = this.mixedAmbientLight.map((ambientColors => {
        let mixing = ambientColors - this.states._useMetalness;
        return Math.max(0, mixing);
      }));
    }
    fillShader.setUniform('uAmbientLightCount', ambientLightCount);
    fillShader.setUniform('uAmbientColor', this.mixedAmbientLight);

    const spotLightCount = this.states.spotLightDiffuseColors.length / 3;
    fillShader.setUniform('uSpotLightCount', spotLightCount);
    fillShader.setUniform('uSpotLightAngle', this.states.spotLightAngle);
    fillShader.setUniform('uSpotLightConc', this.states.spotLightConc);
    fillShader.setUniform('uSpotLightDiffuseColors', this.states.spotLightDiffuseColors);
    fillShader.setUniform(
      'uSpotLightSpecularColors',
      this.states.spotLightSpecularColors
    );
    fillShader.setUniform('uSpotLightLocation', this.states.spotLightPositions);
    fillShader.setUniform('uSpotLightDirection', this.states.spotLightDirections);

    fillShader.setUniform('uConstantAttenuation', this.states.constantAttenuation);
    fillShader.setUniform('uLinearAttenuation', this.states.linearAttenuation);
    fillShader.setUniform('uQuadraticAttenuation', this.states.quadraticAttenuation);

    fillShader.bindTextures();
  }

  // getting called from _setFillUniforms
  _setImageLightUniforms(shader) {
    //set uniform values
    shader.setUniform('uUseImageLight', this.states.activeImageLight != null);
    // true
    if (this.states.activeImageLight) {
      // this.states.activeImageLight has image as a key
      // look up the texture from the diffusedTexture map
      let diffusedLight = this.getDiffusedTexture(this.states.activeImageLight);
      shader.setUniform('environmentMapDiffused', diffusedLight);
      let specularLight = this.getSpecularTexture(this.states.activeImageLight);

      shader.setUniform('environmentMapSpecular', specularLight);
    }
  }

  _setPointUniforms(pointShader) {
    pointShader.bindShader();

    // set the uniform values
    pointShader.setUniform('uMaterialColor', this.states.curStrokeColor);
    // @todo is there an instance where this isn't stroke weight?
    // should be they be same var?
    pointShader.setUniform(
      'uPointSize',
      this.pointSize * this._pixelDensity
    );
  }

  /* Binds a buffer to the drawing context
  * when passed more than two arguments it also updates or initializes
  * the data associated with the buffer
  */
  _bindBuffer(
    buffer,
    target,
    values,
    type,
    usage
  ) {
    if (!target) target = this.GL.ARRAY_BUFFER;
    this.GL.bindBuffer(target, buffer);
    if (values !== undefined) {
      let data = values;
      if (values instanceof DataArray) {
        data = values.dataArray();
      } else if (!(data instanceof (type || Float32Array))) {
        data = new (type || Float32Array)(data);
      }
      this.GL.bufferData(target, data, usage || this.GL.STATIC_DRAW);
    }
  }

  ///////////////////////////////
  //// UTILITY FUNCTIONS
  //////////////////////////////
  _arraysEqual(a, b) {
    const aLength = a.length;
    if (aLength !== b.length) return false;
    return a.every((ai, i) => ai === b[i]);
  }

  _isTypedArray(arr) {
    return [
      Float32Array,
      Float64Array,
      Int16Array,
      Uint16Array,
      Uint32Array
    ].some(x => arr instanceof x);
  }
  /**
   * turn a two dimensional array into one dimensional array
   * @private
   * @param  {Array} arr 2-dimensional array
   * @return {Array}     1-dimensional array
   * [[1, 2, 3],[4, 5, 6]] -> [1, 2, 3, 4, 5, 6]
   */
  _flatten(arr) {
    return arr.flat();
  }

  /**
   * turn a p5.Vector Array into a one dimensional number array
   * @private
   * @param  {p5.Vector[]} arr  an array of p5.Vector
   * @return {Number[]}     a one dimensional array of numbers
   * [p5.Vector(1, 2, 3), p5.Vector(4, 5, 6)] ->
   * [1, 2, 3, 4, 5, 6]
   */
  _vToNArray(arr) {
    return arr.flatMap(item => [item.x, item.y, item.z]);
  }

  // function to calculate BezierVertex Coefficients
  _bezierCoefficients(t) {
    const t2 = t * t;
    const t3 = t2 * t;
    const mt = 1 - t;
    const mt2 = mt * mt;
    const mt3 = mt2 * mt;
    return [mt3, 3 * mt2 * t, 3 * mt * t2, t3];
  }

  // function to calculate QuadraticVertex Coefficients
  _quadraticCoefficients(t) {
    const t2 = t * t;
    const mt = 1 - t;
    const mt2 = mt * mt;
    return [mt2, 2 * mt * t, t2];
  }

  // function to convert Bezier coordinates to Catmull Rom Splines
  _bezierToCatmull(w) {
    const p1 = w[1];
    const p2 = w[1] + (w[2] - w[0]) / this._curveTightness;
    const p3 = w[2] - (w[3] - w[1]) / this._curveTightness;
    const p4 = w[2];
    const p = [p1, p2, p3, p4];
    return p;
  }
  _initTessy() {
    this.tessyVertexSize = 12;
    // function called for each vertex of tesselator output
    function vertexCallback(data, polyVertArray) {
      for (const element of data) {
        polyVertArray.push(element);
      }
    }

    function begincallback(type) {
      if (type !== libtess.primitiveType.GL_TRIANGLES) {
        console.log(`expected TRIANGLES but got type: ${type}`);
      }
    }

    function errorcallback(errno) {
      console.log('error callback');
      console.log(`error number: ${errno}`);
    }
    // callback for when segments intersect and must be split
    const combinecallback = (coords, data, weight) => {
      const result = new Array(this.tessyVertexSize).fill(0);
      for (let i = 0; i < weight.length; i++) {
        for (let j = 0; j < result.length; j++) {
          if (weight[i] === 0 || !data[i]) continue;
          result[j] += data[i][j] * weight[i];
        }
      }
      return result;
    };

    function edgeCallback(flag) {
      // don't really care about the flag, but need no-strip/no-fan behavior
    }

    const tessy = new libtess.GluTesselator();
    tessy.gluTessCallback(libtess.gluEnum.GLU_TESS_VERTEX_DATA, vertexCallback);
    tessy.gluTessCallback(libtess.gluEnum.GLU_TESS_BEGIN, begincallback);
    tessy.gluTessCallback(libtess.gluEnum.GLU_TESS_ERROR, errorcallback);
    tessy.gluTessCallback(libtess.gluEnum.GLU_TESS_COMBINE, combinecallback);
    tessy.gluTessCallback(libtess.gluEnum.GLU_TESS_EDGE_FLAG, edgeCallback);
    tessy.gluTessProperty(
      libtess.gluEnum.GLU_TESS_WINDING_RULE,
      libtess.windingRule.GLU_TESS_WINDING_NONZERO
    );

    return tessy;
  }

  _triangulate(contours) {
    // libtess will take 3d verts and flatten to a plane for tesselation.
    // libtess is capable of calculating a plane to tesselate on, but
    // if all of the vertices have the same z values, we'll just
    // assume the face is facing the camera, letting us skip any performance
    // issues or bugs in libtess's automatic calculation.
    const z = contours[0] ? contours[0][2] : undefined;
    let allSameZ = true;
    for (const contour of contours) {
      for (
        let j = 0;
        j < contour.length;
        j += this.tessyVertexSize
      ) {
        if (contour[j + 2] !== z) {
          allSameZ = false;
          break;
        }
      }
    }
    if (allSameZ) {
      this._tessy.gluTessNormal(0, 0, 1);
    } else {
      // Let libtess pick a plane for us
      this._tessy.gluTessNormal(0, 0, 0);
    }

    const triangleVerts = [];
    this._tessy.gluTessBeginPolygon(triangleVerts);

    for (const contour of contours) {
      this._tessy.gluTessBeginContour();
      for (
        let j = 0;
        j < contour.length;
        j += this.tessyVertexSize
      ) {
        const coords = contour.slice(
          j,
          j + this.tessyVertexSize
        );
        this._tessy.gluTessVertex(coords, coords);
      }
      this._tessy.gluTessEndContour();
    }

    // finish polygon
    this._tessy.gluTessEndPolygon();

    return triangleVerts;
  }
};

function rendererGL(p5, fn){
  p5.RendererGL = RendererGL;

  /**
   * @module Rendering
   * @submodule Rendering
   * @for p5
   */
  /**
   * Set attributes for the WebGL Drawing context.
   * This is a way of adjusting how the WebGL
   * renderer works to fine-tune the display and performance.
   *
   * Note that this will reinitialize the drawing context
   * if called after the WebGL canvas is made.
   *
   * If an object is passed as the parameter, all attributes
   * not declared in the object will be set to defaults.
   *
   * The available attributes are:
   * <br>
   * alpha - indicates if the canvas contains an alpha buffer
   * default is true
   *
   * depth - indicates whether the drawing buffer has a depth buffer
   * of at least 16 bits - default is true
   *
   * stencil - indicates whether the drawing buffer has a stencil buffer
   * of at least 8 bits
   *
   * antialias - indicates whether or not to perform anti-aliasing
   * default is false (true in Safari)
   *
   * premultipliedAlpha - indicates that the page compositor will assume
   * the drawing buffer contains colors with pre-multiplied alpha
   * default is true
   *
   * preserveDrawingBuffer - if true the buffers will not be cleared and
   * and will preserve their values until cleared or overwritten by author
   * (note that p5 clears automatically on draw loop)
   * default is true
   *
   * perPixelLighting - if true, per-pixel lighting will be used in the
   * lighting shader otherwise per-vertex lighting is used.
   * default is true.
   *
   * version - either 1 or 2, to specify which WebGL version to ask for. By
   * default, WebGL 2 will be requested. If WebGL2 is not available, it will
   * fall back to WebGL 1. You can check what version is used with by looking at
   * the global `webglVersion` property.
   *
   * @method setAttributes
   * @for p5
   * @param  {String}  key Name of attribute
   * @param  {Boolean}        value New value of named attribute
   * @example
   * <div>
   * <code>
   * function setup() {
   *   createCanvas(100, 100, WEBGL);
   * }
   *
   * function draw() {
   *   background(255);
   *   push();
   *   rotateZ(frameCount * 0.02);
   *   rotateX(frameCount * 0.02);
   *   rotateY(frameCount * 0.02);
   *   fill(0, 0, 0);
   *   box(50);
   *   pop();
   * }
   * </code>
   * </div>
   * <br>
   * Now with the antialias attribute set to true.
   * <br>
   * <div>
   * <code>
   * function setup() {
   *   setAttributes('antialias', true);
   *   createCanvas(100, 100, WEBGL);
   * }
   *
   * function draw() {
   *   background(255);
   *   push();
   *   rotateZ(frameCount * 0.02);
   *   rotateX(frameCount * 0.02);
   *   rotateY(frameCount * 0.02);
   *   fill(0, 0, 0);
   *   box(50);
   *   pop();
   * }
   * </code>
   * </div>
   *
   * <div>
   * <code>
   * // press the mouse button to disable perPixelLighting
   * function setup() {
   *   createCanvas(100, 100, WEBGL);
   *   noStroke();
   *   fill(255);
   * }
   *
   * let lights = [
   *   { c: '#f00', t: 1.12, p: 1.91, r: 0.2 },
   *   { c: '#0f0', t: 1.21, p: 1.31, r: 0.2 },
   *   { c: '#00f', t: 1.37, p: 1.57, r: 0.2 },
   *   { c: '#ff0', t: 1.12, p: 1.91, r: 0.7 },
   *   { c: '#0ff', t: 1.21, p: 1.31, r: 0.7 },
   *   { c: '#f0f', t: 1.37, p: 1.57, r: 0.7 }
   * ];
   *
   * function draw() {
   *   let t = millis() / 1000 + 1000;
   *   background(0);
   *   directionalLight(color('#222'), 1, 1, 1);
   *
   *   for (let i = 0; i < lights.length; i++) {
   *     let light = lights[i];
   *     pointLight(
   *       color(light.c),
   *       p5.Vector.fromAngles(t * light.t, t * light.p, width * light.r)
   *     );
   *   }
   *
   *   specularMaterial(255);
   *   sphere(width * 0.1);
   *
   *   rotateX(t * 0.77);
   *   rotateY(t * 0.83);
   *   rotateZ(t * 0.91);
   *   torus(width * 0.3, width * 0.07, 24, 10);
   * }
   *
   * function mousePressed() {
   *   setAttributes('perPixelLighting', false);
   *   noStroke();
   *   fill(255);
   * }
   * function mouseReleased() {
   *   setAttributes('perPixelLighting', true);
   *   noStroke();
   *   fill(255);
   * }
   * </code>
   * </div>
   *
   * @alt a rotating cube with smoother edges
   */
  /**
   * @method setAttributes
   * @for p5
   * @param  {Object}  obj object with key-value pairs
   */
  fn.setAttributes = function (key, value) {
    if (typeof this._glAttributes === 'undefined') {
      console.log(
        'You are trying to use setAttributes on a p5.Graphics object ' +
        'that does not use a WEBGL renderer.'
      );
      return;
    }
    let unchanged = true;
    if (typeof value !== 'undefined') {
      //first time modifying the attributes
      if (this._glAttributes === null) {
        this._glAttributes = {};
      }
      if (this._glAttributes[key] !== value) {
        //changing value of previously altered attribute
        this._glAttributes[key] = value;
        unchanged = false;
      }
      //setting all attributes with some change
    } else if (key instanceof Object) {
      if (this._glAttributes !== key) {
        this._glAttributes = key;
        unchanged = false;
      }
    }
    //@todo_FES
    if (!this._renderer.isP3D || unchanged) {
      return;
    }

    if (!this._setupDone) {
      for (const x in this._renderer.retainedMode.geometry) {
        if (this._renderer.retainedMode.geometry.hasOwnProperty(x)) {
          p5._friendlyError(
            'Sorry, Could not set the attributes, you need to call setAttributes() ' +
            'before calling the other drawing methods in setup()'
          );
          return;
        }
      }
    }

    this.push();
    this._renderer._resetContext();
    this.pop();

    if (this._renderer.states.curCamera) {
      this._renderer.states.curCamera._renderer = this._renderer;
    }
  };

  /**
   * ensures that p5 is using a 3d renderer. throws an error if not.
   */
  fn._assert3d = function (name) {
    if (!this._renderer.isP3D)
      throw new Error(
        `${name}() is only supported in WEBGL mode. If you'd like to use 3D graphics and WebGL, see  https://p5js.org/examples/form-3d-primitives.html for more information.`
      );
  };

  p5.renderers[constants.WEBGL] = p5.RendererGL;
  p5.renderers[constants.WEBGL2] = p5.RendererGL;
  RendererGL = p5.RendererGL;

  ///////////////////////
  /// 2D primitives
  /////////////////////////
  //
  // Note: Documentation is not generated on the p5.js website for functions on
  // the p5.RendererGL prototype.

  /**
   * Draws a point, a coordinate in space at the dimension of one pixel,
   * given x, y and z coordinates. The color of the point is determined
   * by the current stroke, while the point size is determined by current
   * stroke weight.
   * @private
   * @param {Number} x x-coordinate of point
   * @param {Number} y y-coordinate of point
   * @param {Number} z z-coordinate of point
   * @chainable
   * @example
   * <div>
   * <code>
   * function setup() {
   *   createCanvas(100, 100, WEBGL);
   * }
   *
   * function draw() {
   *   background(50);
   *   stroke(255);
   *   strokeWeight(4);
   *   point(25, 0);
   *   strokeWeight(3);
   *   point(-25, 0);
   *   strokeWeight(2);
   *   point(0, 25);
   *   strokeWeight(1);
   *   point(0, -25);
   * }
   * </code>
   * </div>
   */
  p5.RendererGL.prototype.point = function(x, y, z = 0) {

    const _vertex = [];
    _vertex.push(new Vector(x, y, z));
    this._drawPoints(_vertex, this.immediateMode.buffers.point);

    return this;
  };

  p5.RendererGL.prototype.triangle = function(args) {
    const x1 = args[0],
      y1 = args[1];
    const x2 = args[2],
      y2 = args[3];
    const x3 = args[4],
      y3 = args[5];

    const gId = 'tri';
    if (!this.geometryInHash(gId)) {
      const _triangle = function() {
        const vertices = [];
        vertices.push(new Vector(0, 0, 0));
        vertices.push(new Vector(1, 0, 0));
        vertices.push(new Vector(0, 1, 0));
        this.edges = [[0, 1], [1, 2], [2, 0]];
        this.vertices = vertices;
        this.faces = [[0, 1, 2]];
        this.uvs = [0, 0, 1, 0, 1, 1];
      };
      const triGeom = new Geometry(1, 1, _triangle);
      triGeom._edgesToVertices();
      triGeom.computeNormals();
      this.createBuffers(gId, triGeom);
    }

    // only one triangle is cached, one point is at the origin, and the
    // two adjacent sides are tne unit vectors along the X & Y axes.
    //
    // this matrix multiplication transforms those two unit vectors
    // onto the required vector prior to rendering, and moves the
    // origin appropriately.
    const uModelMatrix = this.states.uModelMatrix.copy();
    try {
      // triangle orientation.
      const orientation = Math.sign(x1*y2-x2*y1 + x2*y3-x3*y2 + x3*y1-x1*y3);
      const mult = new Matrix([
        x2 - x1, y2 - y1, 0, 0, // the resulting unit X-axis
        x3 - x1, y3 - y1, 0, 0, // the resulting unit Y-axis
        0, 0, orientation, 0,   // the resulting unit Z-axis (Reflect the specified order of vertices)
        x1, y1, 0, 1            // the resulting origin
      ]).mult(this.states.uModelMatrix);

      this.states.uModelMatrix = mult;

      this.drawBuffers(gId);
    } finally {
      this.states.uModelMatrix = uModelMatrix;
    }

    return this;
  };

  p5.RendererGL.prototype.ellipse = function(args) {
    this.arc(
      args[0],
      args[1],
      args[2],
      args[3],
      0,
      constants.TWO_PI,
      constants.OPEN,
      args[4]
    );
  };

  p5.RendererGL.prototype.arc = function(...args) {
    const x = args[0];
    const y = args[1];
    const width = args[2];
    const height = args[3];
    const start = args[4];
    const stop = args[5];
    const mode = args[6];
    const detail = args[7] || 25;

    let shape;
    let gId;

    // check if it is an ellipse or an arc
    if (Math.abs(stop - start) >= constants.TWO_PI) {
      shape = 'ellipse';
      gId = `${shape}|${detail}|`;
    } else {
      shape = 'arc';
      gId = `${shape}|${start}|${stop}|${mode}|${detail}|`;
    }

    if (!this.geometryInHash(gId)) {
      const _arc = function() {

        // if the start and stop angles are not the same, push vertices to the array
        if (start.toFixed(10) !== stop.toFixed(10)) {
          // if the mode specified is PIE or null, push the mid point of the arc in vertices
          if (mode === constants.PIE || typeof mode === 'undefined') {
            this.vertices.push(new Vector(0.5, 0.5, 0));
            this.uvs.push([0.5, 0.5]);
          }

          // vertices for the perimeter of the circle
          for (let i = 0; i <= detail; i++) {
            const u = i / detail;
            const theta = (stop - start) * u + start;

            const _x = 0.5 + Math.cos(theta) / 2;
            const _y = 0.5 + Math.sin(theta) / 2;

            this.vertices.push(new Vector(_x, _y, 0));
            this.uvs.push([_x, _y]);

            if (i < detail - 1) {
              this.faces.push([0, i + 1, i + 2]);
              this.edges.push([i + 1, i + 2]);
            }
          }

          // check the mode specified in order to push vertices and faces, different for each mode
          switch (mode) {
            case constants.PIE:
              this.faces.push([
                0,
                this.vertices.length - 2,
                this.vertices.length - 1
              ]);
              this.edges.push([0, 1]);
              this.edges.push([
                this.vertices.length - 2,
                this.vertices.length - 1
              ]);
              this.edges.push([0, this.vertices.length - 1]);
              break;

            case constants.CHORD:
              this.edges.push([0, 1]);
              this.edges.push([0, this.vertices.length - 1]);
              break;

            case constants.OPEN:
              this.edges.push([0, 1]);
              break;

            default:
              this.faces.push([
                0,
                this.vertices.length - 2,
                this.vertices.length - 1
              ]);
              this.edges.push([
                this.vertices.length - 2,
                this.vertices.length - 1
              ]);
          }
        }
      };

      const arcGeom = new Geometry(detail, 1, _arc);
      arcGeom.computeNormals();

      if (detail <= 50) {
        arcGeom._edgesToVertices(arcGeom);
      } else if (this.states.doStroke) {
        console.log(
          `Cannot apply a stroke to an ${shape} with more than 50 detail`
        );
      }

      this.createBuffers(gId, arcGeom);
    }

    const uModelMatrix = this.states.uModelMatrix.copy();

    try {
      this.states.uModelMatrix.translate([x, y, 0]);
      this.states.uModelMatrix.scale(width, height, 1);

      this.drawBuffers(gId);
    } finally {
      this.states.uModelMatrix = uModelMatrix;
    }

    return this;
  };

  p5.RendererGL.prototype.rect = function(args) {
    const x = args[0];
    const y = args[1];
    const width = args[2];
    const height = args[3];

    if (typeof args[4] === 'undefined') {
      // Use the retained mode for drawing rectangle,
      // if args for rounding rectangle is not provided by user.
      const perPixelLighting = this._pInst._glAttributes.perPixelLighting;
      const detailX = args[4] || (perPixelLighting ? 1 : 24);
      const detailY = args[5] || (perPixelLighting ? 1 : 16);
      const gId = `rect|${detailX}|${detailY}`;
      if (!this.geometryInHash(gId)) {
        const _rect = function() {
          for (let i = 0; i <= this.detailY; i++) {
            const v = i / this.detailY;
            for (let j = 0; j <= this.detailX; j++) {
              const u = j / this.detailX;
              const p = new Vector(u, v, 0);
              this.vertices.push(p);
              this.uvs.push(u, v);
            }
          }
          // using stroke indices to avoid stroke over face(s) of rectangle
          if (detailX > 0 && detailY > 0) {
            this.edges = [
              [0, detailX],
              [detailX, (detailX + 1) * (detailY + 1) - 1],
              [(detailX + 1) * (detailY + 1) - 1, (detailX + 1) * detailY],
              [(detailX + 1) * detailY, 0]
            ];
          }
        };
        const rectGeom = new Geometry(detailX, detailY, _rect);
        rectGeom
          .computeFaces()
          .computeNormals()
          ._edgesToVertices();
        this.createBuffers(gId, rectGeom);
      }

      // only a single rectangle (of a given detail) is cached: a square with
      // opposite corners at (0,0) & (1,1).
      //
      // before rendering, this square is scaled & moved to the required location.
      const uModelMatrix = this.states.uModelMatrix.copy();
      try {
        this.states.uModelMatrix.translate([x, y, 0]);
        this.states.uModelMatrix.scale(width, height, 1);

        this.drawBuffers(gId);
      } finally {
        this.states.uModelMatrix = uModelMatrix;
      }
    } else {
      // Use Immediate mode to round the rectangle corner,
      // if args for rounding corners is provided by user
      let tl = args[4];
      let tr = typeof args[5] === 'undefined' ? tl : args[5];
      let br = typeof args[6] === 'undefined' ? tr : args[6];
      let bl = typeof args[7] === 'undefined' ? br : args[7];

      let a = x;
      let b = y;
      let c = width;
      let d = height;

      c += a;
      d += b;

      if (a > c) {
        const temp = a;
        a = c;
        c = temp;
      }

      if (b > d) {
        const temp = b;
        b = d;
        d = temp;
      }

      const maxRounding = Math.min((c - a) / 2, (d - b) / 2);
      if (tl > maxRounding) tl = maxRounding;
      if (tr > maxRounding) tr = maxRounding;
      if (br > maxRounding) br = maxRounding;
      if (bl > maxRounding) bl = maxRounding;

      let x1 = a;
      let y1 = b;
      let x2 = c;
      let y2 = d;

      this.beginShape();
      if (tr !== 0) {
        this.vertex(x2 - tr, y1);
        this.quadraticVertex(x2, y1, x2, y1 + tr);
      } else {
        this.vertex(x2, y1);
      }
      if (br !== 0) {
        this.vertex(x2, y2 - br);
        this.quadraticVertex(x2, y2, x2 - br, y2);
      } else {
        this.vertex(x2, y2);
      }
      if (bl !== 0) {
        this.vertex(x1 + bl, y2);
        this.quadraticVertex(x1, y2, x1, y2 - bl);
      } else {
        this.vertex(x1, y2);
      }
      if (tl !== 0) {
        this.vertex(x1, y1 + tl);
        this.quadraticVertex(x1, y1, x1 + tl, y1);
      } else {
        this.vertex(x1, y1);
      }

      this.immediateMode.geometry.uvs.length = 0;
      for (const vert of this.immediateMode.geometry.vertices) {
        const u = (vert.x - x1) / width;
        const v = (vert.y - y1) / height;
        this.immediateMode.geometry.uvs.push(u, v);
      }

      this.endShape(constants.CLOSE);
    }
    return this;
  };

  /* eslint-disable max-len */
  p5.RendererGL.prototype.quad = function(x1, y1, z1, x2, y2, z2, x3, y3, z3, x4, y4, z4, detailX=2, detailY=2) {
    /* eslint-enable max-len */

    const gId =
      `quad|${x1}|${y1}|${z1}|${x2}|${y2}|${z2}|${x3}|${y3}|${z3}|${x4}|${y4}|${z4}|${detailX}|${detailY}`;

    if (!this.geometryInHash(gId)) {
      const quadGeom = new Geometry(detailX, detailY, function() {
        //algorithm adapted from c++ to js
        //https://stackoverflow.com/questions/16989181/whats-the-correct-way-to-draw-a-distorted-plane-in-opengl/16993202#16993202
        let xRes = 1.0 / (this.detailX - 1);
        let yRes = 1.0 / (this.detailY - 1);
        for (let y = 0; y < this.detailY; y++) {
          for (let x = 0; x < this.detailX; x++) {
            let pctx = x * xRes;
            let pcty = y * yRes;

            let linePt0x = (1 - pcty) * x1 + pcty * x4;
            let linePt0y = (1 - pcty) * y1 + pcty * y4;
            let linePt0z = (1 - pcty) * z1 + pcty * z4;
            let linePt1x = (1 - pcty) * x2 + pcty * x3;
            let linePt1y = (1 - pcty) * y2 + pcty * y3;
            let linePt1z = (1 - pcty) * z2 + pcty * z3;

            let ptx = (1 - pctx) * linePt0x + pctx * linePt1x;
            let pty = (1 - pctx) * linePt0y + pctx * linePt1y;
            let ptz = (1 - pctx) * linePt0z + pctx * linePt1z;

            this.vertices.push(new Vector(ptx, pty, ptz));
            this.uvs.push([pctx, pcty]);
          }
        }
      });

      quadGeom.faces = [];
      for(let y = 0; y < detailY-1; y++){
        for(let x = 0; x < detailX-1; x++){
          let pt0 = x + y * detailX;
          let pt1 = (x + 1) + y * detailX;
          let pt2 = (x + 1) + (y + 1) * detailX;
          let pt3 = x + (y + 1) * detailX;
          quadGeom.faces.push([pt0, pt1, pt2]);
          quadGeom.faces.push([pt0, pt2, pt3]);
        }
      }
      quadGeom.computeNormals();
      quadGeom.edges.length = 0;
      const vertexOrder = [0, 2, 3, 1];
      for (let i = 0; i < vertexOrder.length; i++) {
        const startVertex = vertexOrder[i];
        const endVertex = vertexOrder[(i + 1) % vertexOrder.length];
        quadGeom.edges.push([startVertex, endVertex]);
      }
      quadGeom._edgesToVertices();
      this.createBuffers(gId, quadGeom);
    }
    this.drawBuffers(gId);
    return this;
  };

  //this implementation of bezier curve
  //is based on Bernstein polynomial
  // pretier-ignore
  p5.RendererGL.prototype.bezier = function(
    x1,
    y1,
    z1, // x2
    x2, // y2
    y2, // x3
    z2, // y3
    x3, // x4
    y3, // y4
    z3,
    x4,
    y4,
    z4
  ) {
    if (arguments.length === 8) {
      y4 = y3;
      x4 = x3;
      y3 = z2;
      x3 = y2;
      y2 = x2;
      x2 = z1;
      z1 = z2 = z3 = z4 = 0;
    }
    const bezierDetail = this._pInst._bezierDetail || 20; //value of Bezier detail
    this.beginShape();
    for (let i = 0; i <= bezierDetail; i++) {
      const c1 = Math.pow(1 - i / bezierDetail, 3);
      const c2 = 3 * (i / bezierDetail) * Math.pow(1 - i / bezierDetail, 2);
      const c3 = 3 * Math.pow(i / bezierDetail, 2) * (1 - i / bezierDetail);
      const c4 = Math.pow(i / bezierDetail, 3);
      this.vertex(
        x1 * c1 + x2 * c2 + x3 * c3 + x4 * c4,
        y1 * c1 + y2 * c2 + y3 * c3 + y4 * c4,
        z1 * c1 + z2 * c2 + z3 * c3 + z4 * c4
      );
    }
    this.endShape();
    return this;
  };

  // pretier-ignore
  p5.RendererGL.prototype.curve = function(
    x1,
    y1,
    z1, // x2
    x2, // y2
    y2, // x3
    z2, // y3
    x3, // x4
    y3, // y4
    z3,
    x4,
    y4,
    z4
  ) {
    if (arguments.length === 8) {
      x4 = x3;
      y4 = y3;
      x3 = y2;
      y3 = x2;
      x2 = z1;
      y2 = x2;
      z1 = z2 = z3 = z4 = 0;
    }
    const curveDetail = this._pInst._curveDetail;
    this.beginShape();
    for (let i = 0; i <= curveDetail; i++) {
      const c1 = Math.pow(i / curveDetail, 3) * 0.5;
      const c2 = Math.pow(i / curveDetail, 2) * 0.5;
      const c3 = i / curveDetail * 0.5;
      const c4 = 0.5;
      const vx =
        c1 * (-x1 + 3 * x2 - 3 * x3 + x4) +
        c2 * (2 * x1 - 5 * x2 + 4 * x3 - x4) +
        c3 * (-x1 + x3) +
        c4 * (2 * x2);
      const vy =
        c1 * (-y1 + 3 * y2 - 3 * y3 + y4) +
        c2 * (2 * y1 - 5 * y2 + 4 * y3 - y4) +
        c3 * (-y1 + y3) +
        c4 * (2 * y2);
      const vz =
        c1 * (-z1 + 3 * z2 - 3 * z3 + z4) +
        c2 * (2 * z1 - 5 * z2 + 4 * z3 - z4) +
        c3 * (-z1 + z3) +
        c4 * (2 * z2);
      this.vertex(vx, vy, vz);
    }
    this.endShape();
    return this;
  };

  /**
   * Draw a line given two points
   * @private
   * @param {Number} x0 x-coordinate of first vertex
   * @param {Number} y0 y-coordinate of first vertex
   * @param {Number} z0 z-coordinate of first vertex
   * @param {Number} x1 x-coordinate of second vertex
   * @param {Number} y1 y-coordinate of second vertex
   * @param {Number} z1 z-coordinate of second vertex
   * @chainable
   * @example
   * <div>
   * <code>
   * //draw a line
   * function setup() {
   *   createCanvas(100, 100, WEBGL);
   * }
   *
   * function draw() {
   *   background(200);
   *   rotateX(frameCount * 0.01);
   *   rotateY(frameCount * 0.01);
   *   // Use fill instead of stroke to change the color of shape.
   *   fill(255, 0, 0);
   *   line(10, 10, 0, 60, 60, 20);
   * }
   * </code>
   * </div>
   */
  p5.RendererGL.prototype.line = function(...args) {
    if (args.length === 6) {
      this.beginShape(constants.LINES);
      this.vertex(args[0], args[1], args[2]);
      this.vertex(args[3], args[4], args[5]);
      this.endShape();
    } else if (args.length === 4) {
      this.beginShape(constants.LINES);
      this.vertex(args[0], args[1], 0);
      this.vertex(args[2], args[3], 0);
      this.endShape();
    }
    return this;
  };

  p5.RendererGL.prototype.bezierVertex = function(...args) {
    if (this.immediateMode._bezierVertex.length === 0) {
      throw Error('vertex() must be used once before calling bezierVertex()');
    } else {
      let w_x = [];
      let w_y = [];
      let w_z = [];
      let t, _x, _y, _z, i, k, m;
      // variable i for bezierPoints, k for components, and m for anchor points.
      const argLength = args.length;

      t = 0;

      if (
        this._lookUpTableBezier.length === 0 ||
        this._lutBezierDetail !== this._pInst._curveDetail
      ) {
        this._lookUpTableBezier = [];
        this._lutBezierDetail = this._pInst._curveDetail;
        const step = 1 / this._lutBezierDetail;
        let start = 0;
        let end = 1;
        let j = 0;
        while (start < 1) {
          t = parseFloat(start.toFixed(6));
          this._lookUpTableBezier[j] = this._bezierCoefficients(t);
          if (end.toFixed(6) === step.toFixed(6)) {
            t = parseFloat(end.toFixed(6)) + parseFloat(start.toFixed(6));
            ++j;
            this._lookUpTableBezier[j] = this._bezierCoefficients(t);
            break;
          }
          start += step;
          end -= step;
          ++j;
        }
      }

      const LUTLength = this._lookUpTableBezier.length;
      const immediateGeometry = this.immediateMode.geometry;

      // fillColors[0]: start point color
      // fillColors[1],[2]: control point color
      // fillColors[3]: end point color
      const fillColors = [];
      for (m = 0; m < 4; m++) fillColors.push([]);
      fillColors[0] = immediateGeometry.vertexColors.slice(-4);
      fillColors[3] = this.states.curFillColor.slice();

      // Do the same for strokeColor.
      const strokeColors = [];
      for (m = 0; m < 4; m++) strokeColors.push([]);
      strokeColors[0] = immediateGeometry.vertexStrokeColors.slice(-4);
      strokeColors[3] = this.states.curStrokeColor.slice();

      // Do the same for custom vertex properties
      const userVertexProperties = {};
      for (const propName in immediateGeometry.userVertexProperties){
        const prop = immediateGeometry.userVertexProperties[propName];
        const size = prop.getDataSize();
        userVertexProperties[propName] = [];
        for (m = 0; m < 4; m++) userVertexProperties[propName].push([]);
        userVertexProperties[propName][0] = prop.getSrcArray().slice(-size);
        userVertexProperties[propName][3] = prop.getCurrentData();
      }

      if (argLength === 6) {
        this.isBezier = true;

        w_x = [this.immediateMode._bezierVertex[0], args[0], args[2], args[4]];
        w_y = [this.immediateMode._bezierVertex[1], args[1], args[3], args[5]];
        // The ratio of the distance between the start point, the two control-
        // points, and the end point determines the intermediate color.
        let d0 = Math.hypot(w_x[0]-w_x[1], w_y[0]-w_y[1]);
        let d1 = Math.hypot(w_x[1]-w_x[2], w_y[1]-w_y[2]);
        let d2 = Math.hypot(w_x[2]-w_x[3], w_y[2]-w_y[3]);
        const totalLength = d0 + d1 + d2;
        d0 /= totalLength;
        d2 /= totalLength;
        for (k = 0; k < 4; k++) {
          fillColors[1].push(
            fillColors[0][k] * (1-d0) + fillColors[3][k] * d0
          );
          fillColors[2].push(
            fillColors[0][k] * d2 + fillColors[3][k] * (1-d2)
          );
          strokeColors[1].push(
            strokeColors[0][k] * (1-d0) + strokeColors[3][k] * d0
          );
          strokeColors[2].push(
            strokeColors[0][k] * d2 + strokeColors[3][k] * (1-d2)
          );
        }
        for (const propName in immediateGeometry.userVertexProperties){
          const size = immediateGeometry.userVertexProperties[propName].getDataSize();
          for (k = 0; k < size; k++){
            userVertexProperties[propName][1].push(
              userVertexProperties[propName][0][k] * (1-d0) + userVertexProperties[propName][3][k] * d0
            );
            userVertexProperties[propName][2].push(
              userVertexProperties[propName][0][k] * (1-d2) + userVertexProperties[propName][3][k] * d2
            );
          }
        }

        for (let i = 0; i < LUTLength; i++) {
          // Interpolate colors using control points
          this.states.curFillColor = [0, 0, 0, 0];
          this.states.curStrokeColor = [0, 0, 0, 0];
          _x = _y = 0;
          for (let m = 0; m < 4; m++) {
            for (let k = 0; k < 4; k++) {
              this.states.curFillColor[k] +=
                this._lookUpTableBezier[i][m] * fillColors[m][k];
              this.states.curStrokeColor[k] +=
                this._lookUpTableBezier[i][m] * strokeColors[m][k];
            }
            _x += w_x[m] * this._lookUpTableBezier[i][m];
            _y += w_y[m] * this._lookUpTableBezier[i][m];
          }
          for (const propName in immediateGeometry.userVertexProperties){
            const prop = immediateGeometry.userVertexProperties[propName];
            const size = prop.getDataSize();
            let newValues = Array(size).fill(0);
            for (let m = 0; m < 4; m++){
              for (let k = 0; k < size; k++){
                newValues[k] += this._lookUpTableBezier[i][m] * userVertexProperties[propName][m][k];
              }
            }
            prop.setCurrentData(newValues);
          }
          this.vertex(_x, _y);
        }
        // so that we leave currentColor with the last value the user set it to
        this.states.curFillColor = fillColors[3];
        this.states.curStrokeColor = strokeColors[3];
        for (const propName in immediateGeometry.userVertexProperties) {
          const prop = immediateGeometry.userVertexProperties[propName];
          prop.setCurrentData(userVertexProperties[propName][2]);
        }
        this.immediateMode._bezierVertex[0] = args[4];
        this.immediateMode._bezierVertex[1] = args[5];
      } else if (argLength === 9) {
        this.isBezier = true;

        w_x = [this.immediateMode._bezierVertex[0], args[0], args[3], args[6]];
        w_y = [this.immediateMode._bezierVertex[1], args[1], args[4], args[7]];
        w_z = [this.immediateMode._bezierVertex[2], args[2], args[5], args[8]];
        // The ratio of the distance between the start point, the two control-
        // points, and the end point determines the intermediate color.
        let d0 = Math.hypot(w_x[0]-w_x[1], w_y[0]-w_y[1], w_z[0]-w_z[1]);
        let d1 = Math.hypot(w_x[1]-w_x[2], w_y[1]-w_y[2], w_z[1]-w_z[2]);
        let d2 = Math.hypot(w_x[2]-w_x[3], w_y[2]-w_y[3], w_z[2]-w_z[3]);
        const totalLength = d0 + d1 + d2;
        d0 /= totalLength;
        d2 /= totalLength;
        for (let k = 0; k < 4; k++) {
          fillColors[1].push(
            fillColors[0][k] * (1-d0) + fillColors[3][k] * d0
          );
          fillColors[2].push(
            fillColors[0][k] * d2 + fillColors[3][k] * (1-d2)
          );
          strokeColors[1].push(
            strokeColors[0][k] * (1-d0) + strokeColors[3][k] * d0
          );
          strokeColors[2].push(
            strokeColors[0][k] * d2 + strokeColors[3][k] * (1-d2)
          );
        }
        for (const propName in immediateGeometry.userVertexProperties){
          const size = immediateGeometry.userVertexProperties[propName].getDataSize();
          for (k = 0; k < size; k++){
            userVertexProperties[propName][1].push(
              userVertexProperties[propName][0][k] * (1-d0) + userVertexProperties[propName][3][k] * d0
            );
            userVertexProperties[propName][2].push(
              userVertexProperties[propName][0][k] * (1-d2) + userVertexProperties[propName][3][k] * d2
            );
          }
        }
        for (let i = 0; i < LUTLength; i++) {
          // Interpolate colors using control points
          this.states.curFillColor = [0, 0, 0, 0];
          this.states.curStrokeColor = [0, 0, 0, 0];
          _x = _y = _z = 0;
          for (m = 0; m < 4; m++) {
            for (k = 0; k < 4; k++) {
              this.states.curFillColor[k] +=
                this._lookUpTableBezier[i][m] * fillColors[m][k];
              this.states.curStrokeColor[k] +=
                this._lookUpTableBezier[i][m] * strokeColors[m][k];
            }
            _x += w_x[m] * this._lookUpTableBezier[i][m];
            _y += w_y[m] * this._lookUpTableBezier[i][m];
            _z += w_z[m] * this._lookUpTableBezier[i][m];
          }
          for (const propName in immediateGeometry.userVertexProperties){
            const prop = immediateGeometry.userVertexProperties[propName];
            const size = prop.getDataSize();
            let newValues = Array(size).fill(0);
            for (let m = 0; m < 4; m++){
              for (let k = 0; k < size; k++){
                newValues[k] += this._lookUpTableBezier[i][m] * userVertexProperties[propName][m][k];
              }
            }
            prop.setCurrentData(newValues);
          }
          this.vertex(_x, _y, _z);
        }
        // so that we leave currentColor with the last value the user set it to
        this.states.curFillColor = fillColors[3];
        this.states.curStrokeColor = strokeColors[3];
        for (const propName in immediateGeometry.userVertexProperties) {
          const prop = immediateGeometry.userVertexProperties[propName];
          prop.setCurrentData(userVertexProperties[propName][2]);
        }
        this.immediateMode._bezierVertex[0] = args[6];
        this.immediateMode._bezierVertex[1] = args[7];
        this.immediateMode._bezierVertex[2] = args[8];
      }
    }
  };

  p5.RendererGL.prototype.quadraticVertex = function(...args) {
    if (this.immediateMode._quadraticVertex.length === 0) {
      throw Error('vertex() must be used once before calling quadraticVertex()');
    } else {
      let w_x = [];
      let w_y = [];
      let w_z = [];
      let t, _x, _y, _z, i, k, m;
      // variable i for bezierPoints, k for components, and m for anchor points.
      const argLength = args.length;

      t = 0;

      if (
        this._lookUpTableQuadratic.length === 0 ||
        this._lutQuadraticDetail !== this._pInst._curveDetail
      ) {
        this._lookUpTableQuadratic = [];
        this._lutQuadraticDetail = this._pInst._curveDetail;
        const step = 1 / this._lutQuadraticDetail;
        let start = 0;
        let end = 1;
        let j = 0;
        while (start < 1) {
          t = parseFloat(start.toFixed(6));
          this._lookUpTableQuadratic[j] = this._quadraticCoefficients(t);
          if (end.toFixed(6) === step.toFixed(6)) {
            t = parseFloat(end.toFixed(6)) + parseFloat(start.toFixed(6));
            ++j;
            this._lookUpTableQuadratic[j] = this._quadraticCoefficients(t);
            break;
          }
          start += step;
          end -= step;
          ++j;
        }
      }

      const LUTLength = this._lookUpTableQuadratic.length;
      const immediateGeometry = this.immediateMode.geometry;

      // fillColors[0]: start point color
      // fillColors[1]: control point color
      // fillColors[2]: end point color
      const fillColors = [];
      for (m = 0; m < 3; m++) fillColors.push([]);
      fillColors[0] = immediateGeometry.vertexColors.slice(-4);
      fillColors[2] = this.states.curFillColor.slice();

      // Do the same for strokeColor.
      const strokeColors = [];
      for (m = 0; m < 3; m++) strokeColors.push([]);
      strokeColors[0] = immediateGeometry.vertexStrokeColors.slice(-4);
      strokeColors[2] = this.states.curStrokeColor.slice();

      // Do the same for user defined vertex properties
      const userVertexProperties = {};
      for (const propName in immediateGeometry.userVertexProperties){
        const prop = immediateGeometry.userVertexProperties[propName];
        const size = prop.getDataSize();
        userVertexProperties[propName] = [];
        for (m = 0; m < 3; m++) userVertexProperties[propName].push([]);
        userVertexProperties[propName][0] = prop.getSrcArray().slice(-size);
        userVertexProperties[propName][2] = prop.getCurrentData();
      }

      if (argLength === 4) {
        this.isQuadratic = true;

        w_x = [this.immediateMode._quadraticVertex[0], args[0], args[2]];
        w_y = [this.immediateMode._quadraticVertex[1], args[1], args[3]];

        // The ratio of the distance between the start point, the control-
        // point, and the end point determines the intermediate color.
        let d0 = Math.hypot(w_x[0]-w_x[1], w_y[0]-w_y[1]);
        let d1 = Math.hypot(w_x[1]-w_x[2], w_y[1]-w_y[2]);
        const totalLength = d0 + d1;
        d0 /= totalLength;
        for (let k = 0; k < 4; k++) {
          fillColors[1].push(
            fillColors[0][k] * (1-d0) + fillColors[2][k] * d0
          );
          strokeColors[1].push(
            strokeColors[0][k] * (1-d0) + strokeColors[2][k] * d0
          );
        }
        for (const propName in immediateGeometry.userVertexProperties){
          const prop = immediateGeometry.userVertexProperties[propName];
          const size = prop.getDataSize();
          for (let k = 0; k < size; k++){
            userVertexProperties[propName][1].push(
              userVertexProperties[propName][0][k] * (1-d0) + userVertexProperties[propName][2][k] * d0
            );
          }
        }

        for (let i = 0; i < LUTLength; i++) {
          // Interpolate colors using control points
          this.states.curFillColor = [0, 0, 0, 0];
          this.states.curStrokeColor = [0, 0, 0, 0];
          _x = _y = 0;
          for (let m = 0; m < 3; m++) {
            for (let k = 0; k < 4; k++) {
              this.states.curFillColor[k] +=
                this._lookUpTableQuadratic[i][m] * fillColors[m][k];
              this.states.curStrokeColor[k] +=
                this._lookUpTableQuadratic[i][m] * strokeColors[m][k];
            }
            _x += w_x[m] * this._lookUpTableQuadratic[i][m];
            _y += w_y[m] * this._lookUpTableQuadratic[i][m];
          }

          for (const propName in immediateGeometry.userVertexProperties) {
            const prop = immediateGeometry.userVertexProperties[propName];
            const size = prop.getDataSize();
            let newValues = Array(size).fill(0);
            for (let m = 0; m < 3; m++){
              for (let k = 0; k < size; k++){
                newValues[k] += this._lookUpTableQuadratic[i][m] * userVertexProperties[propName][m][k];
              }
            }
            prop.setCurrentData(newValues);
          }
          this.vertex(_x, _y);
        }

        // so that we leave currentColor with the last value the user set it to
        this.states.curFillColor = fillColors[2];
        this.states.curStrokeColor = strokeColors[2];
        for (const propName in immediateGeometry.userVertexProperties) {
          const prop = immediateGeometry.userVertexProperties[propName];
          prop.setCurrentData(userVertexProperties[propName][2]);
        }
        this.immediateMode._quadraticVertex[0] = args[2];
        this.immediateMode._quadraticVertex[1] = args[3];
      } else if (argLength === 6) {
        this.isQuadratic = true;

        w_x = [this.immediateMode._quadraticVertex[0], args[0], args[3]];
        w_y = [this.immediateMode._quadraticVertex[1], args[1], args[4]];
        w_z = [this.immediateMode._quadraticVertex[2], args[2], args[5]];

        // The ratio of the distance between the start point, the control-
        // point, and the end point determines the intermediate color.
        let d0 = Math.hypot(w_x[0]-w_x[1], w_y[0]-w_y[1], w_z[0]-w_z[1]);
        let d1 = Math.hypot(w_x[1]-w_x[2], w_y[1]-w_y[2], w_z[1]-w_z[2]);
        const totalLength = d0 + d1;
        d0 /= totalLength;
        for (k = 0; k < 4; k++) {
          fillColors[1].push(
            fillColors[0][k] * (1-d0) + fillColors[2][k] * d0
          );
          strokeColors[1].push(
            strokeColors[0][k] * (1-d0) + strokeColors[2][k] * d0
          );
        }

        for (const propName in immediateGeometry.userVertexProperties){
          const prop = immediateGeometry.userVertexProperties[propName];
          const size = prop.getDataSize();
          for (let k = 0; k < size; k++){
            userVertexProperties[propName][1].push(
              userVertexProperties[propName][0][k] * (1-d0) + userVertexProperties[propName][2][k] * d0
            );
          }
        }

        for (i = 0; i < LUTLength; i++) {
          // Interpolate colors using control points
          this.states.curFillColor = [0, 0, 0, 0];
          this.states.curStrokeColor = [0, 0, 0, 0];
          _x = _y = _z = 0;
          for (m = 0; m < 3; m++) {
            for (k = 0; k < 4; k++) {
              this.states.curFillColor[k] +=
                this._lookUpTableQuadratic[i][m] * fillColors[m][k];
              this.states.curStrokeColor[k] +=
                this._lookUpTableQuadratic[i][m] * strokeColors[m][k];
            }
            _x += w_x[m] * this._lookUpTableQuadratic[i][m];
            _y += w_y[m] * this._lookUpTableQuadratic[i][m];
            _z += w_z[m] * this._lookUpTableQuadratic[i][m];
          }
          for (const propName in immediateGeometry.userVertexProperties) {
            const prop = immediateGeometry.userVertexProperties[propName];
            const size = prop.getDataSize();
            let newValues = Array(size).fill(0);
            for (let m = 0; m < 3; m++){
              for (let k = 0; k < size; k++){
                newValues[k] += this._lookUpTableQuadratic[i][m] * userVertexProperties[propName][m][k];
              }
            }
            prop.setCurrentData(newValues);
          }
          this.vertex(_x, _y, _z);
        }

        // so that we leave currentColor with the last value the user set it to
        this.states.curFillColor = fillColors[2];
        this.states.curStrokeColor = strokeColors[2];
        for (const propName in immediateGeometry.userVertexProperties) {
          const prop = immediateGeometry.userVertexProperties[propName];
          prop.setCurrentData(userVertexProperties[propName][2]);
        }
        this.immediateMode._quadraticVertex[0] = args[3];
        this.immediateMode._quadraticVertex[1] = args[4];
        this.immediateMode._quadraticVertex[2] = args[5];
      }
    }
  };

  p5.RendererGL.prototype.curveVertex = function(...args) {
    let w_x = [];
    let w_y = [];
    let w_z = [];
    let t, _x, _y, _z, i;
    t = 0;
    const argLength = args.length;

    if (
      this._lookUpTableBezier.length === 0 ||
      this._lutBezierDetail !== this._pInst._curveDetail
    ) {
      this._lookUpTableBezier = [];
      this._lutBezierDetail = this._pInst._curveDetail;
      const step = 1 / this._lutBezierDetail;
      let start = 0;
      let end = 1;
      let j = 0;
      while (start < 1) {
        t = parseFloat(start.toFixed(6));
        this._lookUpTableBezier[j] = this._bezierCoefficients(t);
        if (end.toFixed(6) === step.toFixed(6)) {
          t = parseFloat(end.toFixed(6)) + parseFloat(start.toFixed(6));
          ++j;
          this._lookUpTableBezier[j] = this._bezierCoefficients(t);
          break;
        }
        start += step;
        end -= step;
        ++j;
      }
    }

    const LUTLength = this._lookUpTableBezier.length;

    if (argLength === 2) {
      this.immediateMode._curveVertex.push(args[0]);
      this.immediateMode._curveVertex.push(args[1]);
      if (this.immediateMode._curveVertex.length === 8) {
        this.isCurve = true;
        w_x = this._bezierToCatmull([
          this.immediateMode._curveVertex[0],
          this.immediateMode._curveVertex[2],
          this.immediateMode._curveVertex[4],
          this.immediateMode._curveVertex[6]
        ]);
        w_y = this._bezierToCatmull([
          this.immediateMode._curveVertex[1],
          this.immediateMode._curveVertex[3],
          this.immediateMode._curveVertex[5],
          this.immediateMode._curveVertex[7]
        ]);
        for (i = 0; i < LUTLength; i++) {
          _x =
            w_x[0] * this._lookUpTableBezier[i][0] +
            w_x[1] * this._lookUpTableBezier[i][1] +
            w_x[2] * this._lookUpTableBezier[i][2] +
            w_x[3] * this._lookUpTableBezier[i][3];
          _y =
            w_y[0] * this._lookUpTableBezier[i][0] +
            w_y[1] * this._lookUpTableBezier[i][1] +
            w_y[2] * this._lookUpTableBezier[i][2] +
            w_y[3] * this._lookUpTableBezier[i][3];
          this.vertex(_x, _y);
        }
        for (i = 0; i < argLength; i++) {
          this.immediateMode._curveVertex.shift();
        }
      }
    } else if (argLength === 3) {
      this.immediateMode._curveVertex.push(args[0]);
      this.immediateMode._curveVertex.push(args[1]);
      this.immediateMode._curveVertex.push(args[2]);
      if (this.immediateMode._curveVertex.length === 12) {
        this.isCurve = true;
        w_x = this._bezierToCatmull([
          this.immediateMode._curveVertex[0],
          this.immediateMode._curveVertex[3],
          this.immediateMode._curveVertex[6],
          this.immediateMode._curveVertex[9]
        ]);
        w_y = this._bezierToCatmull([
          this.immediateMode._curveVertex[1],
          this.immediateMode._curveVertex[4],
          this.immediateMode._curveVertex[7],
          this.immediateMode._curveVertex[10]
        ]);
        w_z = this._bezierToCatmull([
          this.immediateMode._curveVertex[2],
          this.immediateMode._curveVertex[5],
          this.immediateMode._curveVertex[8],
          this.immediateMode._curveVertex[11]
        ]);
        for (i = 0; i < LUTLength; i++) {
          _x =
            w_x[0] * this._lookUpTableBezier[i][0] +
            w_x[1] * this._lookUpTableBezier[i][1] +
            w_x[2] * this._lookUpTableBezier[i][2] +
            w_x[3] * this._lookUpTableBezier[i][3];
          _y =
            w_y[0] * this._lookUpTableBezier[i][0] +
            w_y[1] * this._lookUpTableBezier[i][1] +
            w_y[2] * this._lookUpTableBezier[i][2] +
            w_y[3] * this._lookUpTableBezier[i][3];
          _z =
            w_z[0] * this._lookUpTableBezier[i][0] +
            w_z[1] * this._lookUpTableBezier[i][1] +
            w_z[2] * this._lookUpTableBezier[i][2] +
            w_z[3] * this._lookUpTableBezier[i][3];
          this.vertex(_x, _y, _z);
        }
        for (i = 0; i < argLength; i++) {
          this.immediateMode._curveVertex.shift();
        }
      }
    }
  };

  p5.RendererGL.prototype.image = function(
    img,
    sx,
    sy,
    sWidth,
    sHeight,
    dx,
    dy,
    dWidth,
    dHeight
  ) {
    if (this._isErasing) {
      this.blendMode(this._cachedBlendMode);
    }

    this._pInst.push();

    this._pInst.noLights();
    this._pInst.noStroke();

    this._pInst.texture(img);
    this._pInst.textureMode(constants.NORMAL);

    let u0 = 0;
    if (sx <= img.width) {
      u0 = sx / img.width;
    }

    let u1 = 1;
    if (sx + sWidth <= img.width) {
      u1 = (sx + sWidth) / img.width;
    }

    let v0 = 0;
    if (sy <= img.height) {
      v0 = sy / img.height;
    }

    let v1 = 1;
    if (sy + sHeight <= img.height) {
      v1 = (sy + sHeight) / img.height;
    }

    this.beginShape();
    this.vertex(dx, dy, 0, u0, v0);
    this.vertex(dx + dWidth, dy, 0, u1, v0);
    this.vertex(dx + dWidth, dy + dHeight, 0, u1, v1);
    this.vertex(dx, dy + dHeight, 0, u0, v1);
    this.endShape(constants.CLOSE);

    this._pInst.pop();

    if (this._isErasing) {
      this.blendMode(constants.REMOVE);
    }
  };
}

/**
 * @private
 * @param {Uint8Array|Float32Array|undefined} pixels An existing pixels array to reuse if the size is the same
 * @param {WebGLRenderingContext} gl The WebGL context
 * @param {WebGLFramebuffer|null} framebuffer The Framebuffer to read
 * @param {Number} x The x coordiante to read, premultiplied by pixel density
 * @param {Number} y The y coordiante to read, premultiplied by pixel density
 * @param {Number} width The width in pixels to be read (factoring in pixel density)
 * @param {Number} height The height in pixels to be read (factoring in pixel density)
 * @param {GLEnum} format Either RGB or RGBA depending on how many channels to read
 * @param {GLEnum} type The datatype of each channel, e.g. UNSIGNED_BYTE or FLOAT
 * @param {Number|undefined} flipY If provided, the total height with which to flip the y axis about
 * @returns {Uint8Array|Float32Array} pixels A pixels array with the current state of the
 * WebGL context read into it
 */
export function readPixelsWebGL(
  pixels,
  gl,
  framebuffer,
  x,
  y,
  width,
  height,
  format,
  type,
  flipY
) {
  // Record the currently bound framebuffer so we can go back to it after, and
  // bind the framebuffer we want to read from
  const prevFramebuffer = gl.getParameter(gl.FRAMEBUFFER_BINDING);
  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);

  const channels = format === gl.RGBA ? 4 : 3;

  // Make a pixels buffer if it doesn't already exist
  const len = width * height * channels;
  const TypedArrayClass = type === gl.UNSIGNED_BYTE ? Uint8Array : Float32Array;
  if (!(pixels instanceof TypedArrayClass) || pixels.length !== len) {
    pixels = new TypedArrayClass(len);
  }

  gl.readPixels(
    x,
    flipY ? (flipY - y - height) : y,
    width,
    height,
    format,
    type,
    pixels
  );

  // Re-bind whatever was previously bound
  gl.bindFramebuffer(gl.FRAMEBUFFER, prevFramebuffer);

  if (flipY) {
    // WebGL pixels are inverted compared to 2D pixels, so we have to flip
    // the resulting rows. Adapted from https://stackoverflow.com/a/41973289
    const halfHeight = Math.floor(height / 2);
    const tmpRow = new TypedArrayClass(width * channels);
    for (let y = 0; y < halfHeight; y++) {
      const topOffset = y * width * 4;
      const bottomOffset = (height - y - 1) * width * 4;
      tmpRow.set(pixels.subarray(topOffset, topOffset + width * 4));
      pixels.copyWithin(topOffset, bottomOffset, bottomOffset + width * 4);
      pixels.set(tmpRow, bottomOffset);
    }
  }

  return pixels;
}

/**
 * @private
 * @param {WebGLRenderingContext} gl The WebGL context
 * @param {WebGLFramebuffer|null} framebuffer The Framebuffer to read
 * @param {Number} x The x coordinate to read, premultiplied by pixel density
 * @param {Number} y The y coordinate to read, premultiplied by pixel density
 * @param {GLEnum} format Either RGB or RGBA depending on how many channels to read
 * @param {GLEnum} type The datatype of each channel, e.g. UNSIGNED_BYTE or FLOAT
 * @param {Number|undefined} flipY If provided, the total height with which to flip the y axis about
 * @returns {Number[]} pixels The channel data for the pixel at that location
 */
export function readPixelWebGL(
  gl,
  framebuffer,
  x,
  y,
  format,
  type,
  flipY
) {
  // Record the currently bound framebuffer so we can go back to it after, and
  // bind the framebuffer we want to read from
  const prevFramebuffer = gl.getParameter(gl.FRAMEBUFFER_BINDING);
  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);

  const channels = format === gl.RGBA ? 4 : 3;
  const TypedArrayClass = type === gl.UNSIGNED_BYTE ? Uint8Array : Float32Array;
  const pixels = new TypedArrayClass(channels);

  gl.readPixels(
    x, flipY ? (flipY - y - 1) : y, 1, 1,
    format, type,
    pixels
  );

  // Re-bind whatever was previously bound
  gl.bindFramebuffer(gl.FRAMEBUFFER, prevFramebuffer);

  return Array.from(pixels);
}

export default rendererGL;
export { RendererGL };

if(typeof p5 !== 'undefined'){
  rendererGL(p5, p5.prototype);
}
