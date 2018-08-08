/**
 *
 * Firefly3DSymbolLayers
 *  - Esri LineSymbol3DLayer(s) using Firefly symbology
 *  - https://nation.maps.arcgis.com/apps/Cascade/index.html?appid=1b39896bff9946519b53883106ff2838
 *
 * Author:   John Grayson - Applications Prototype Lab - Esri
 * Created:   8/14/2017 - 0.0.1 -
 * Modified: 12/15/2017 - 0.0.2 - trying to move up to 4.6
 *
 */
define([
  "esri/core/Accessor",
  "esri/core/Collection",
  "esri/symbols/LineSymbol3DLayer",
  "dojo/_base/Color",
  "dojo/colors"
], function (Accessor, Collection, LineSymbol3DLayer, Color, colors) {

  const centerColor = [255, 255, 255, 0.7];
  const defaultColor = [255, 0, 0, 1.0];

  const Firefly3DSymbolLayers = Accessor.createSubclass({

    declaredClass: "Firefly3DSymbolLayers",

    properties: {
      color: {
        type: Color,
        value: new Color(defaultColor),
        get: function () {
          return this._get("color");
        },
        set: function (value) {
          this._set("color", value);
        }
      },
      size: {
        type: Number,
        value: 5
      },
      steps: {
        type: Number,
        value: 5
      }
    },

    /**
     *  Create Firefly LineSymbol3DLayers
     *
     * @returns {Array}
     */
    createFireflyLineSymbol3DLayers: function () {

      const fireflyColor = new Color(this.color);
      fireflyColor.a = 0.1;

      const stepSize = (this.size / this.steps);
      const centerLayer = { type: "line", size: (stepSize * 1.5), material: { color: centerColor } };
      //const centerLayer = new LineSymbol3DLayer({ size: (stepSize * 1.5), material: { color: centerColor } });

      const lineSizes = Array(this.steps).fill().map((_, i) => (i + 1) * (stepSize * 2));
      const fireflyLayers = lineSizes.map((lineSize) => {
        return { type: "line", size: lineSize, material: { color: fireflyColor } };
        //return new LineSymbol3DLayer({ size: lineSize, material: { color: fireflyColor } });
      });
      
      return fireflyLayers.concat(centerLayer);
    }

  });

  Firefly3DSymbolLayers.version = "0.0.2";

  return Firefly3DSymbolLayers;
});