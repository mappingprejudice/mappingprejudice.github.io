/**
 *
 * FireflyPolygonSymbol3D
 *  - Esri PolygonSymbol3D using Firefly symbology
 *
 * Author:   John Grayson - Applications Prototype Lab - Esri
 * Created:   8/14/2017 - 0.0.1 -
 * Modified: 12/15/2017 - 0.0.2 - trying to move up to 4.6
 *
 */
define([
  "esri/core/Collection",
  "esri/symbols/PolygonSymbol3D",
  "./_Firefly3DSymbolLayers"
], function (Collection, PolygonSymbol3D, _Firefly3DSymbolLayers) {

  const FireflyPolygonSymbol3D = PolygonSymbol3D.createSubclass([_Firefly3DSymbolLayers], {

    declaredClass: "FireflyPolygonSymbol3D",

    properties: {
      symbolLayers: {
        type: Collection,
        dependsOn: ["color", "size", "steps"],
        get: function () {
          return this.createFireflyLineSymbol3DLayers()
        }
      }
    }

  });

  FireflyPolygonSymbol3D.version = "0.0.2";

  return FireflyPolygonSymbol3D;
});