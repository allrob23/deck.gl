// deck.gl
// SPDX-License-Identifier: MIT
// Copyright (c) vis.gl contributors

import {
  Accessor,
  Color,
  CompositeLayer,
  CompositeLayerProps,
  Layer,
  LayerData,
  PickingInfo,
  Unit,
  Material,
  UpdateParameters,
  _ConstructorOf,
  DefaultProps
} from '@deck.gl/core';

import type {BinaryFeatureCollection} from '@loaders.gl/schema';
import type {Feature, Geometry, GeoJSON} from 'geojson';

import {replaceInRange} from '../utils';
import {BinaryFeatureTypes, binaryToFeatureForAccesor} from './geojson-binary';
import {
  POINT_LAYER,
  LINE_LAYER,
  POLYGON_LAYER,
  getDefaultProps,
  forwardProps
} from './sub-layer-map';

import {getGeojsonFeatures, SeparatedGeometries, separateGeojsonFeatures} from './geojson';
import {
  createLayerPropsFromFeatures,
  createLayerPropsFromBinary,
  SubLayersProps
} from './geojson-layer-props';

/** All properties supported by GeoJsonLayer */
export type GeoJsonLayerProps<FeaturePropertiesT = unknown> =
  _GeoJsonLayerProps<FeaturePropertiesT> & CompositeLayerProps;

/** Properties added by GeoJsonLayer */
export type _GeoJsonLayerProps<FeaturePropertiesT> = {
  data:
    | string
    | GeoJSON
    | Feature[]
    | BinaryFeatureCollection
    | Promise<GeoJSON | Feature[] | BinaryFeatureCollection>;
  /**
   * How to render Point and MultiPoint features in the data.
   *
   * Supported types are:
   *  * `'circle'`
   *  * `'icon'`
   *  * `'text'`
   *
   * @default 'circle'
   */
  pointType?: string;
} & _GeoJsonLayerFillProps<FeaturePropertiesT> &
  _GeoJsonLayerStrokeProps<FeaturePropertiesT> &
  _GeoJsonLayer3DProps<FeaturePropertiesT> &
  _GeoJsonLayerPointCircleProps<FeaturePropertiesT> &
  _GeojsonLayerIconPointProps<FeaturePropertiesT> &
  _GeojsonLayerTextPointProps<FeaturePropertiesT>;

/** GeoJsonLayer fill options. */
type _GeoJsonLayerFillProps<FeaturePropertiesT> = {
  /**
   * Whether to draw a filled polygon (solid fill).
   *
   * Note that only the area between the outer polygon and any holes will be filled.
   *
   * @default true
   */
  filled?: boolean;

  /**
   * Fill collor value or accessor.
   *
   * @default [0, 0, 0, 255]
   */
  getFillColor?: Accessor<Feature<Geometry, FeaturePropertiesT>, Color>;
};

/** GeoJsonLayer stroke options. */
type _GeoJsonLayerStrokeProps<FeaturePropertiesT> = {
  /**
   * Whether to draw an outline around the polygon (solid fill).
   *
   * Note that both the outer polygon as well the outlines of any holes will be drawn.
   *
   * @default true
   */
  stroked?: boolean;

  /**
   * Line color value or accessor.
   *
   * @default [0, 0, 0, 255]
   */
  getLineColor?: Accessor<Feature<Geometry, FeaturePropertiesT>, Color>;

  /**
   * Line width value or accessor.
   *
   * @default 1
   */
  getLineWidth?: Accessor<Feature<Geometry, FeaturePropertiesT>, number>;

  /**
   * The units of the line width, one of `meters`, `common`, and `pixels`.
   *
   * @default 'meters'
   * @see Unit.
   */
  lineWidthUnits?: Unit;

  /**
   * A multiplier that is applied to all line widths
   *
   * @default 1
   */
  lineWidthScale?: number;

  /**
   * The minimum line width in pixels.
   *
   * @default 0
   */
  lineWidthMinPixels?: number;

  /**
   * The maximum line width in pixels
   *
   * @default Number.MAX_SAFE_INTEGER
   */
  lineWidthMaxPixels?: number;

  /**
   * Type of joint. If `true`, draw round joints. Otherwise draw miter joints.
   *
   * @default false
   */
  lineJointRounded?: boolean;

  /**
   * The maximum extent of a joint in ratio to the stroke width.
   *
   * Only works if `lineJointRounded` is false.
   *
   * @default 4
   */
  lineMiterLimit?: number;

  /**
   * Type of line caps.
   *
   * If `true`, draw round caps. Otherwise draw square caps.
   *
   * @default false
   */
  lineCapRounded?: boolean;

  /**
   * If `true`, extrude the line in screen space (width always faces the camera).
   * If `false`, the width always faces up.
   *
   * @default false
   */
  lineBillboard?: boolean;
};

/** GeoJsonLayer 3D options. */
type _GeoJsonLayer3DProps<FeaturePropertiesT> = {
  /**
   * Extrude Polygon and MultiPolygon features along the z-axis if set to true
   *
   * Based on the elevations provided by the `getElevation` accessor.
   *
   * @default false
   */
  extruded?: boolean;

  /**
   * Whether to generate a line wireframe of the hexagon.
   *
   * @default false
   */
  wireframe?: boolean;

  /**
   * (Experimental) This prop is only effective with `XYZ` data.
   * When true, polygon tesselation will be performed on the plane with the largest area, instead of the xy plane.
   * @default false
   */
  _full3d?: boolean;

  /**
   * Elevation valur or accessor.
   *
   * Only used if `extruded: true`.
   *
   * @default 1000
   */
  getElevation?: Accessor<Feature<Geometry, FeaturePropertiesT>, number>;

  /**
   * Elevation multiplier.
   *
   * The final elevation is calculated by `elevationScale * getElevation(d)`.
   * `elevationScale` is a handy property to scale all elevation without updating the data.
   *
   * @default 1
   */
  elevationScale?: boolean;

  /**
   * Material settings for lighting effect. Applies to extruded polgons.
   *
   * @default true
   * @see https://deck.gl/docs/developer-guide/using-lighting
   */
  material?: Material;
};

/** GeoJsonLayer Properties forwarded to `ScatterPlotLayer` if `pointType` is `'circle'` */
export type _GeoJsonLayerPointCircleProps<FeaturePropertiesT> = {
  getPointRadius?: Accessor<Feature<Geometry, FeaturePropertiesT>, number>;
  pointRadiusUnits?: Unit;
  pointRadiusScale?: number;
  pointRadiusMinPixels?: number;
  pointRadiusMaxPixels?: number;
  pointAntialiasing?: boolean;
  pointBillboard?: boolean;

  /** @deprecated use getPointRadius */
  getRadius?: Accessor<Feature<Geometry, FeaturePropertiesT>, number>;
};

/** GeoJsonLayer properties forwarded to `IconLayer` if `pointType` is `'icon'` */
type _GeojsonLayerIconPointProps<FeaturePropertiesT> = {
  iconAtlas?: any;
  iconMapping?: any;
  getIcon?: Accessor<Feature<Geometry, FeaturePropertiesT>, any>;
  getIconSize?: Accessor<Feature<Geometry, FeaturePropertiesT>, number>;
  getIconColor?: Accessor<Feature<Geometry, FeaturePropertiesT>, Color>;
  getIconAngle?: Accessor<Feature<Geometry, FeaturePropertiesT>, number>;
  getIconPixelOffset?: Accessor<Feature<Geometry, FeaturePropertiesT>, number[]>;
  iconSizeUnits?: Unit;
  iconSizeScale?: number;
  iconSizeMinPixels?: number;
  iconSizeMaxPixels?: number;
  iconBillboard?: boolean;
  iconAlphaCutoff?: number;
};

/** GeoJsonLayer properties forwarded to `TextLayer` if `pointType` is `'text'` */
type _GeojsonLayerTextPointProps<FeaturePropertiesT> = {
  getText?: Accessor<Feature<Geometry, FeaturePropertiesT>, any>;
  getTextColor?: Accessor<Feature<Geometry, FeaturePropertiesT>, Color>;
  getTextAngle?: Accessor<Feature<Geometry, FeaturePropertiesT>, number>;
  getTextSize?: Accessor<Feature<Geometry, FeaturePropertiesT>, number>;
  getTextAnchor?: Accessor<Feature<Geometry, FeaturePropertiesT>, string>;
  getTextAlignmentBaseline?: Accessor<Feature<Geometry, FeaturePropertiesT>, string>;
  getTextPixelOffset?: Accessor<Feature<Geometry, FeaturePropertiesT>, number[]>;
  getTextBackgroundColor?: Accessor<Feature<Geometry, FeaturePropertiesT>, Color>;
  getTextBorderColor?: Accessor<Feature<Geometry, FeaturePropertiesT>, Color>;
  getTextBorderWidth?: Accessor<Feature<Geometry, FeaturePropertiesT>, number>;
  textSizeUnits?: Unit;
  textSizeScale?: number;
  textSizeMinPixels?: number;
  textSizeMaxPixels?: number;
  textCharacterSet?: any;
  textFontFamily?: string;
  textFontWeight?: number;
  textLineHeight?: number;
  textMaxWidth?: number;
  textWordBreak?: string; // TODO
  textBackground?: boolean;
  textBackgroundPadding?: number[];
  textOutlineColor?: Color;
  textOutlineWidth?: number;
  textBillboard?: boolean;
  textFontSettings?: any;
};

const FEATURE_TYPES = ['points', 'linestrings', 'polygons'];

const defaultProps: DefaultProps<GeoJsonLayerProps> = {
  ...getDefaultProps(POINT_LAYER.circle),
  ...getDefaultProps(POINT_LAYER.icon),
  ...getDefaultProps(POINT_LAYER.text),
  ...getDefaultProps(LINE_LAYER),
  ...getDefaultProps(POLYGON_LAYER),

  // Overwrite sub layer defaults
  stroked: true,
  filled: true,
  extruded: false,
  wireframe: false,
  _full3d: false,
  iconAtlas: {type: 'object', value: null},
  iconMapping: {type: 'object', value: {}},
  getIcon: {type: 'accessor', value: f => f.properties.icon},
  getText: {type: 'accessor', value: f => f.properties.text},

  // Self props
  pointType: 'circle',

  // TODO: deprecated, remove in v9
  getRadius: {deprecatedFor: 'getPointRadius'}
};

type GeoJsonPickingInfo = PickingInfo & {
  featureType?: string | null;
  info?: any;
};

/** Render GeoJSON formatted data as polygons, lines and points (circles, icons and/or texts). */
export default class GeoJsonLayer<
  FeaturePropertiesT = any,
  ExtraProps extends {} = {}
> extends CompositeLayer<Required<_GeoJsonLayerProps<FeaturePropertiesT>> & ExtraProps> {
  static layerName = 'GeoJsonLayer';
  static defaultProps = defaultProps;

  state!: {
    layerProps: Partial<SubLayersProps>;
    features: Partial<SeparatedGeometries>;
    featuresDiff: Partial<{
      [key in keyof SeparatedGeometries]: {
        startRow: number;
        endRow: number;
      }[];
    }>;
    binary?: boolean;
  };

  initializeState(): void {
    this.state = {
      layerProps: {},
      features: {},
      featuresDiff: {}
    };
  }

  updateState({props, changeFlags}: UpdateParameters<this>): void {
    if (!changeFlags.dataChanged) {
      return;
    }
    const {data} = this.props;
    const binary =
      data && 'points' in (data as {}) && 'polygons' in (data as {}) && 'lines' in (data as {});

    this.setState({binary});

    if (binary) {
      this._updateStateBinary({props, changeFlags});
    } else {
      this._updateStateJSON({props, changeFlags});
    }
  }

  private _updateStateBinary({props, changeFlags}): void {
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const layerProps = createLayerPropsFromBinary(props.data, this.encodePickingColor);
    this.setState({layerProps});
  }

  private _updateStateJSON({props, changeFlags}): void {
    const features: Feature[] = getGeojsonFeatures(props.data) as any;
    const wrapFeature = this.getSubLayerRow.bind(this);
    let newFeatures: SeparatedGeometries = {} as SeparatedGeometries;
    const featuresDiff = {};

    if (Array.isArray(changeFlags.dataChanged)) {
      const oldFeatures = this.state.features;
      for (const key in oldFeatures) {
        newFeatures[key] = oldFeatures[key].slice();
        featuresDiff[key] = [];
      }

      for (const dataRange of changeFlags.dataChanged) {
        const partialFeatures = separateGeojsonFeatures(features, wrapFeature, dataRange);
        for (const key in oldFeatures) {
          featuresDiff[key].push(
            replaceInRange({
              data: newFeatures[key],
              getIndex: f => f.__source.index,
              dataRange,
              replace: partialFeatures[key]
            })
          );
        }
      }
    } else {
      newFeatures = separateGeojsonFeatures(features, wrapFeature);
    }

    const layerProps = createLayerPropsFromFeatures(newFeatures, featuresDiff);

    this.setState({
      features: newFeatures,
      featuresDiff,
      layerProps
    });
  }

  getPickingInfo(params): GeoJsonPickingInfo {
    const info = super.getPickingInfo(params) as GeoJsonPickingInfo;
    const {index, sourceLayer} = info;
    info.featureType = FEATURE_TYPES.find(ft => sourceLayer!.id.startsWith(`${this.id}-${ft}-`));
    if (index >= 0 && sourceLayer!.id.startsWith(`${this.id}-points-text`) && this.state.binary) {
      info.index = (this.props.data as BinaryFeatureCollection).points!.globalFeatureIds.value[
        index
      ];
    }
    return info;
  }

  _updateAutoHighlight(info: GeoJsonPickingInfo): void {
    // All sub layers except the points layer use source feature index to encode the picking color
    // The points layer uses indices from the points data array.
    const pointLayerIdPrefix = `${this.id}-points-`;
    const sourceIsPoints = info.featureType === 'points';
    for (const layer of this.getSubLayers()) {
      if (layer.id.startsWith(pointLayerIdPrefix) === sourceIsPoints) {
        layer.updateAutoHighlight(info);
      }
    }
  }

  private _renderPolygonLayer(): Layer | null {
    const {extruded, wireframe} = this.props;
    const {layerProps} = this.state;
    const id = 'polygons-fill';

    const PolygonFillLayer =
      this.shouldRenderSubLayer(id, layerProps.polygons?.data) &&
      this.getSubLayerClass(id, POLYGON_LAYER.type);

    if (PolygonFillLayer) {
      const forwardedProps = forwardProps(this, POLYGON_LAYER.props);
      // Avoid building the lineColors attribute if wireframe is off
      const useLineColor = extruded && wireframe;
      if (!useLineColor) {
        delete forwardedProps.getLineColor;
      }
      // using a legacy API to invalid lineColor attributes
      forwardedProps.updateTriggers.lineColors = useLineColor;

      return new PolygonFillLayer(
        forwardedProps,
        this.getSubLayerProps({
          id,
          updateTriggers: forwardedProps.updateTriggers
        }),
        layerProps.polygons
      );
    }
    return null;
  }

  private _renderLineLayers(): (Layer | false)[] | null {
    const {extruded, stroked} = this.props;
    const {layerProps} = this.state;
    const polygonStrokeLayerId = 'polygons-stroke';
    const lineStringsLayerId = 'linestrings';

    const PolygonStrokeLayer =
      !extruded &&
      stroked &&
      this.shouldRenderSubLayer(polygonStrokeLayerId, layerProps.polygonsOutline?.data) &&
      this.getSubLayerClass(polygonStrokeLayerId, LINE_LAYER.type);
    const LineStringsLayer =
      this.shouldRenderSubLayer(lineStringsLayerId, layerProps.lines?.data) &&
      this.getSubLayerClass(lineStringsLayerId, LINE_LAYER.type);

    if (PolygonStrokeLayer || LineStringsLayer) {
      const forwardedProps = forwardProps(this, LINE_LAYER.props);

      return [
        PolygonStrokeLayer &&
          new PolygonStrokeLayer(
            forwardedProps,
            this.getSubLayerProps({
              id: polygonStrokeLayerId,
              updateTriggers: forwardedProps.updateTriggers
            }),
            layerProps.polygonsOutline
          ),

        LineStringsLayer &&
          new LineStringsLayer(
            forwardedProps,
            this.getSubLayerProps({
              id: lineStringsLayerId,
              updateTriggers: forwardedProps.updateTriggers
            }),
            layerProps.lines
          )
      ];
    }
    return null;
  }

  private _renderPointLayers(): Layer[] | null {
    const {pointType} = this.props;
    const {layerProps, binary} = this.state;
    let {highlightedObjectIndex} = this.props;

    if (!binary && Number.isFinite(highlightedObjectIndex)) {
      // @ts-expect-error TODO - type non-binary data
      highlightedObjectIndex = layerProps.points.data.findIndex(
        d => d.__source.index === highlightedObjectIndex
      );
    }

    // Avoid duplicate sub layer ids
    const types = new Set(pointType.split('+'));
    const pointLayers: Layer[] = [];
    for (const type of types) {
      const id = `points-${type}`;
      const PointLayerMapping = POINT_LAYER[type];
      const PointsLayer: _ConstructorOf<Layer> =
        PointLayerMapping &&
        this.shouldRenderSubLayer(id, layerProps.points?.data) &&
        this.getSubLayerClass(id, PointLayerMapping.type);
      if (PointsLayer) {
        const forwardedProps = forwardProps(this, PointLayerMapping.props);
        let pointsLayerProps = layerProps.points;

        if (type === 'text' && binary) {
          // Picking colors are per-point but for text per-character are required
          // getPickingInfo() maps back to the correct index
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          // @ts-expect-error TODO - type binary data

          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const {instancePickingColors, ...rest} = pointsLayerProps.data.attributes;
          pointsLayerProps = {
            ...pointsLayerProps,
            // @ts-expect-error TODO - type binary data
            data: {...(pointsLayerProps.data as LayerData), attributes: rest}
          };
        }

        pointLayers.push(
          new PointsLayer(
            forwardedProps,
            this.getSubLayerProps({
              id,
              updateTriggers: forwardedProps.updateTriggers,
              highlightedObjectIndex
            }),
            pointsLayerProps
          )
        );
      }
    }
    return pointLayers;
  }

  renderLayers() {
    const {extruded} = this.props;

    const polygonFillLayer = this._renderPolygonLayer();
    const lineLayers = this._renderLineLayers();
    const pointLayers = this._renderPointLayers();

    return [
      // If not extruded: flat fill layer is drawn below outlines
      !extruded && polygonFillLayer,
      lineLayers,
      pointLayers,
      // If extruded: draw fill layer last for correct blending behavior
      extruded && polygonFillLayer
    ];
  }

  protected getSubLayerAccessor<In, Out>(accessor: Accessor<In, Out>): Accessor<In, Out> {
    const {binary} = this.state;
    if (!binary || typeof accessor !== 'function') {
      return super.getSubLayerAccessor(accessor);
    }

    return (object, info) => {
      const {data, index} = info;
      const feature = binaryToFeatureForAccesor(data as unknown as BinaryFeatureTypes, index);
      // @ts-ignore (TS2349) accessor is always function
      return accessor(feature, info);
    };
  }
}
