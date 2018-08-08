/*
  Copyright 2017 Esri

  Licensed under the Apache License, Version 2.0 (the "License");
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.
*/

define(
  [
    'dojo/_base/declare',
    'ApplicationBase/ApplicationBase',
    'dojo/i18n!./nls/resources',
    'dojo/text!./CountsByYear.json',
    'ApplicationBase/support/itemUtils',
    'ApplicationBase/support/domHelper',
    'dojo/dom',
    'dojo/dom-class',
    'dojo/dom-construct',
    'dojo/date/locale',
    'dojo/number',
    'dojo/on',
    'dojo/query',
    'dojo/_base/Color',
    'dojo/colors',
    'esri/core/Evented',
    'esri/core/promiseUtils',
    'esri/core/watchUtils',
    'esri/layers/FeatureLayer',
    'esri/geometry/Extent',
    'esri/tasks/support/Query',
    'esri/tasks/support/StatisticDefinition',
    'esri/renderers/smartMapping/statistics/uniqueValues',
    'dojox/charting/Chart',
    'dojox/charting/axis2d/Default',
    'dojox/charting/plot2d/Grid',
    'dojox/charting/themes/Bahamation',
    'dojox/charting/plot2d/Columns',
    'dojox/charting/action2d/Tooltip'
  ],
  function(declare, ApplicationBase, i18n, CountsByYearText, itemUtils, domHelper, dom, domClass, domConstruct, locale, number, on, query, Color, colors, Evented, promiseUtils, watchUtils, FeatureLayer, Extent, Query, StatisticDefinition, uniqueValues, Chart, Default, Grid, ChartTheme, Columns, ChartTooltip) {
    // CONVERT DATE TO DATE/TIME STRING //
    Date.prototype.toAGSDateTimeString = function() {
      return this.getUTCFullYear() +
        '-' +
        String(this.getUTCMonth() + 1).padStart(2, '0') +
        '-' +
        String(this.getUTCDate()).padStart(2, '0') +
        ' ' +
        String(this.getUTCHours()).padStart(2, '0') +
        ':' +
        String(this.getUTCMinutes()).padStart(2, '0') +
        ':' +
        String(this.getUTCSeconds()).padStart(2, '0');
    };

    return declare([Evented], {
      /**
     *
     */
      constructor: function() {
        this.CSS = { loading: 'configurable-application--loading' };
        this.base = null;
      },

      /**
     *
     * @param base
     */
      init: function(base) {
        if (!base) {
          console.error('ApplicationBase is not defined');
          return;
        }
        domHelper.setPageLocale(base.locale);
        domHelper.setPageDirection(base.direction);

        this.base = base;
        const config = base.config;
        const results = base.results;
        const find = config.find;
        const marker = config.marker;

        const allMapItems = results.webMapItems.concat(results.webSceneItems);
        const validMapItems = allMapItems.map(function(response) {
          return response.value;
        });

        const firstItem = validMapItems[0];
        if (!firstItem) {
          console.error('Could not load an item to display');
          return;
        }
        config.title = config.title || itemUtils.getItemTitle(firstItem);
        domHelper.setPageTitle(config.title);

        const viewProperties = itemUtils.getConfigViewProperties(config);
        viewProperties.container = 'view-container';

        const portalItem = this.base.results.applicationItem.value;
        const appProxies = portalItem && portalItem.appProxies
          ? portalItem.appProxies
          : null;

        itemUtils
          .createMapFromItem({ item: firstItem, appProxies: appProxies })
          .then(map => {
            viewProperties.map = map;
            return itemUtils.createView(viewProperties).then(view => {
              // prevent scroll zooming
              view.on('mouse-wheel', function(event) {
                // prevents zooming with the mouse-wheel event
                event.stopPropagation();
              });

              view.when(() => {
                this.viewReady(config, firstItem, view);
              });
            });
          });
      },

      /**
     *
     * @param config
     * @param item
     * @param view
     */
      viewReady: function(config, item, view) {
        view.goTo({ zoom: view.zoom + 1 }).then(() => {
          // APP TITLE //
          dom.byId('app-title').innerHTML = config.title;
          view.ui.add('title-panel', { position: 'top-left', index: 0 });
          domClass.remove('title-panel', 'hide');

          // INFO PANEL //
          view.ui.add('info-panel', { position: 'top-right', index: 0 });
          domClass.remove('info-panel', 'hide');

          // SUBDIVISION BOOKMARK //
          this.initializeZoomToBookmark(view);

          // DOWN CONTAINER //
          const down_container = dom.byId('bottom-container');
          // PANEL TOGGLE //
          const listToggleBtn = domConstruct.create(
            'div',
            {
              className: 'panel-toggle-down icon-ui-down-arrow icon-ui-flush font-size-1',
              title: 'Toggle Panel'
            },
            view.root
          );
          on(listToggleBtn, 'click', () => {
            // TOGGLE PANEL TOGGLE BTN //
            query('.panel-toggle-down').toggleClass(
              'icon-ui-down-arrow icon-ui-up-arrow'
            );
            // TOGGLE VISIBILITY OF CLOSABLE PANELS //
            domClass.toggle(down_container, 'collapsed');
          });
          listToggleBtn.click();

          // TIME FIELD //
          const time_field = 'map_date'; //"YearCovenant";

          const covenants_layer = view.map.layers.find(layer => {
            return layer.title === 'All_Covenants_8_3_2018_V2'; //  "All Covenants by Year"
          });
          covenants_layer.load().then(() => {
            view.whenLayerView(covenants_layer).then(covenants_layerView => {
              covenants_layer.visible = false;

              const covenants_points_layer = view.map.layers.find(layer => {
                return layer.title === 'All_Covenants_Centroids_8_3_2018_V2'; //  "All Covenants by Year as Points"
              });
              covenants_points_layer.load().then(() => {
                covenants_points_layer.visible = false;

                // GET TIME EXTENT //
                this.getLayerTimeExtent(
                  covenants_layer,
                  time_field
                ).then(time_stats => {
                  // TIME EXTENT //
                  const time_extent = {
                    min: new Date(time_stats.min),
                    max: new Date(time_stats.max)
                  };

                  // INITIALIZE RENDERERS //
                  this.updatePolygonTimeRenderer = this.initializePolygonTimeRenderer(
                    covenants_layer,
                    time_field
                  );
                  this.updatePointTimeRenderer = this.initializePointTimeRenderer(
                    covenants_points_layer,
                    time_field
                  );
                  this.highlightByYear = this.initializeHighlight(
                    covenants_layerView,
                    time_field
                  );

                  // SET INITIAL RENDERER USING MIN TIME //
                  this.updatePolygonTimeRenderer(time_extent.min);
                  this.updatePointTimeRenderer(time_extent.min);

                  // UPDATE RENDERERS WHEN TIME CHANGES //
                  this.on('time-change', evt => {
                    this.updatePolygonTimeRenderer(evt.dateTimeValue);
                    this.updatePointTimeRenderer(evt.dateTimeValue);
                    if (this.clearHighlight) {
                      this.clearHighlight();
                    }
                    // if(this.highlightByYear) {
                    //   this.highlightByYear(evt.dateTimeValue);
                    // }
                  });

                  // GET COUNTS BY YEAR CHART //
                  this.initializeYearChart(view, covenants_layer, time_field);
                  // INITIALIZE TIME FILTER //
                  this.initializeTimeFilter(view, time_extent);

                  // DISPLAY LAYERS //
                  covenants_layer.visible = true;
                  covenants_points_layer.visible = true;

                  // ENABLE TIME WHEN LAYER IS READY //
                  watchUtils.whenFalseOnce(
                    covenants_layerView,
                    'updating',
                    () => {
                      // ENABLE TIME UI //
                      domClass.remove('map-container', this.CSS.loading);
                      domClass.remove('time-input', 'btn-disabled');
                      domClass.remove('play-pause-btn', 'btn-disabled');
                      // START ANIMATION //
                      this.autoPlay();
                      //this._calcStats(view, covenants_layerView, time_field);
                    }
                  );
                });
              });
            });
          });
        });
      },

      /**
     *
     * @param layer
     * @param time_field
     * @returns {Promise}
     */
      getLayerTimeExtent: function(layer, time_field) {
        const time_min_stat = new StatisticDefinition({
          statisticType: 'min',
          onStatisticField: time_field,
          outStatisticFieldName: 'time_min'
        });
        const time_max_stat = new StatisticDefinition({
          statisticType: 'max',
          onStatisticField: time_field,
          outStatisticFieldName: 'time_max'
        });

        const time_query = layer.createQuery();
        time_query.outStatistics = [time_min_stat, time_max_stat];
        return layer.queryFeatures(time_query).then(stats_features => {
          const time_stats = stats_features.features[0].attributes;
          return {
            min: time_stats.time_min,
            max: time_stats.time_max
          };
        });
      },

      /**
     *
     * @param layer
     * @param time_field
     * @returns {function(*=)}
     */
      initializePolygonTimeRenderer: function(layer, time_field) {
        const default_layer_symbol = layer.renderer.symbol.clone();

        // OPTION #1 //
        //const default_symbol = default_layer_symbol;

        // OPTION #2 //
        const default_symbol = {
          type: 'simple-fill',
          style: 'solid',
          color: default_layer_symbol.color,
          outline: null
        };

        // OPTION #3 //
        /*const default_symbol = {
        type: "simple-fill",
        style: "solid",
        color: Color.named.darkblue,
        outline: null
      };*/

        const one_hour = 1000 * 60 * 60;
        const one_day = one_hour * 24;
        const one_month = one_day * 30;
        const one_year = one_day * 365;

        return date_time_value => {
          layer.renderer = {
            type: 'simple',
            symbol: default_symbol,
            visualVariables: [
              {
                type: 'opacity',
                field: time_field,
                stops: [
                  {
                    label: 'previous',
                    opacity: 0.0,
                    value: 0
                  },
                  {
                    label: '-one year',
                    opacity: 1.0,
                    value: date_time_value - one_month * 12
                  },
                  {
                    label: 'now',
                    opacity: 1.0,
                    value: date_time_value
                  },
                  {
                    label: '+one year',
                    opacity: 0.0,
                    value: date_time_value + one_month * 12
                  }
                ],
                legendOptions: {
                  showLegend: true
                }
              }
            ]
          };
        };
      },

      /**
     *
     * @param layer
     * @param time_field
     * @returns {function(*=)}
     */
      initializePointTimeRenderer: function(layer, time_field) {
        //const default_symbol = layer.renderer.symbol.clone();
        const default_symbol = {
          type: 'picture-marker',
          //url: "./assets/FireflyHybrid.png",
          url: 'covenants/assets/FireflyCyanToBlueNoWhiteCenter.png',
          width: '16px',
          height: '16px'
        };

        const one_hour = 1000 * 60 * 60;
        const one_day = one_hour * 24;
        const one_month = one_day * 30;
        const one_year = one_day * 365;

        return date_time_value => {
          layer.renderer = {
            type: 'simple',
            symbol: default_symbol,
            visualVariables: [
              {
                type: 'size',
                field: time_field,
                /*minSize: "9px",
              maxSize: {
                type: "size",
                valueExpression: "$view.scale",
                stops: [
                  { value: 1128, size: 60 },
                  { value: 288895, size: 60 },
                  { value: 73957191, size: 37 },
                  { value: 591657528, size: 19 }
                ]
              }*/
                stops: [
                  {
                    label: 'previous',
                    size: 9,
                    value: 0
                  },
                  {
                    label: '-one year',
                    size: 16,
                    value: date_time_value - one_month * 12
                  },
                  {
                    label: 'now',
                    size: 16,
                    value: date_time_value
                  },
                  {
                    label: '+one year',
                    size: 0,
                    value: date_time_value + one_month * 12
                  }
                ]
              },
              {
                type: 'opacity',
                field: time_field,
                stops: [
                  {
                    label: 'previous',
                    opacity: 0.0,
                    value: 0
                  },
                  {
                    label: '-one year',
                    opacity: 0.5,
                    value: date_time_value - one_month * 12
                  },
                  {
                    label: 'now',
                    opacity: 1.0,
                    value: date_time_value
                  },
                  {
                    label: '+one year',
                    opacity: 0.0,
                    value: date_time_value + one_month * 12
                  }
                ],
                legendOptions: {
                  showLegend: true
                }
              }
            ]
          };
        };
      },

      /**
     *
     * @param view
     * @param layerView
     * @param time_field
     * @private
     */
      _calcStats: function(view, layerView, time_field) {
        const year_counts_handles = [];
        for (let year = 1910; year <= 1955; year++) {
          const count_query = layerView.layer.createQuery();
          count_query.outFields = [time_field];
          count_query.where = `(${time_field} >= date '${new Date(Date.parse(year)).toAGSDateTimeString()}') AND (${time_field} < date '${new Date(Date.parse(year + 1)).toAGSDateTimeString()}')`;
          year_counts_handles.push(
            layerView.queryFeatureCount(count_query).then(count => {
              return {
                x: year,
                y: count,
                tooltip: `${year}: ${number.format(count)}`
              };
            })
          );
        }

        promiseUtils
          .eachAlways(year_counts_handles)
          .then(year_counts_results => {
            let total = 0;
            const year_counts = year_counts_results.map(year_counts_result => {
              const year_count = year_counts_result.value;
              year_count.total = (total += year_count.y);
              return year_count;
            });
            console.info(JSON.stringify(year_counts));
          });
      },

      /**
     *
     * @param view
     */
      initializeYearChart: function(view) {
        let year_counts = JSON.parse(CountsByYearText).year_counts;

        const last_year = year_counts[year_counts.length - 1].x;

        const fontColor = '#ccc';
        const lineStroke = { color: '#2493f2', width: 2.0 };

        const countsByYearChart = new Chart('chart-node', {
          margins: { l: 35, t: 10, r: 10, b: 10 }
        });
        countsByYearChart.setTheme(ChartTheme);
        countsByYearChart.fill = (countsByYearChart.theme.plotarea.fill = 'transparent');

        countsByYearChart.addAxis('x', {
          title: 'Year',
          titleGap: 5,
          titleOrientation: 'away',
          titleFontColor: fontColor,
          max: last_year,
          natural: true,
          fixUpper: 'none',
          minorTicks: false,
          majorTick: lineStroke,
          stroke: lineStroke,
          labelFunc: (text, value, precision) => {
            return value;
          },
          titleFont: 'normal normal normal 13pt Avenir Next W00',
          font: 'normal normal normal 9pt Avenir Next W00',
          fontColor: fontColor
        });

        countsByYearChart.addAxis('y', {
          title: 'Count',
          titleGap: 5,
          titleFontColor: fontColor,
          max: 1000,
          vertical: true,
          includeZero: true,
          majorTick: lineStroke,
          gap: 4,
          stroke: lineStroke,
          titleFont: 'normal normal normal 13pt Avenir Next W00',
          font: 'normal normal normal 7pt Avenir Next W00',
          fontColor: fontColor
        });

        /*countsByYearChart.addPlot("grid", {
                type: Grid,
                hMajorLines: true,
                hMinorLines: true,
                vMajorLines: false,
                vMinorLines: false,
                majorHLine: {
                  color: "#ddd",
                  width: 0.5
                },
                minorHLine: {
                  color: "#ddd",
                  width: 0.5
                }
              });*/

        countsByYearChart.addPlot('default', {
          type: Columns,
          gap: 2,
          precision: 1
        });

        countsByYearChart.addSeries('CountsByYear', year_counts, {
          stroke: { color: '#444', width: 1.2 },
          fill: {
            type: 'linear',
            space: 'plot',
            x1: 50,
            y1: 0,
            x2: 50,
            y2: 100,
            colors: [
              {
                offset: 0.00,
                color: Color.named.white
              },
              {
                offset: 0.5,
                color: Color.named.cyan
              },
              {
                offset: 1.00,
                color: new Color([36, 147, 242])
                //color: new Color([0, 121, 193, 0.5])
              }
            ]
          }
        });

        new ChartTooltip(countsByYearChart, 'default');

        countsByYearChart.render();

        view.on('resize', () => {
          countsByYearChart.resize();
        });

        // https://stackoverflow.com/questions/20350527/how-to-apply-click-events-on-axis-in-dojo-graph
        countsByYearChart.connectToPlot('default', evt => {
          switch (evt.type) {
            case 'onclick':
              const data = evt.run.data[evt.index];
              this.highlightByYear(+data.x);
              break;
            default:
              this.clearHighlight();
          }
        });

        //
        // UPDATE CHART AND COUNT NODE WHEN TIME CHANGES //
        //
        const count_node = dom.byId('count-node');
        this.on('time-change', evt => {
          const year = new Date(evt.dateTimeValue).getUTCFullYear();

          const year_index = year_counts.findIndex(year_count => {
            return year_count.x === year;
          });
          const year_count = year_counts[year_index];
          const chart_data = year_counts.slice(0, year_index + 1);

          count_node.innerHTML = number.format(year_count.total);
          countsByYearChart.updateSeries('CountsByYear', chart_data);

          countsByYearChart.render();
        });
      },

      /**
     *
     * @param view
     */
      initializeZoomToBookmark: function(view) {
        if (view.map.bookmarks && view.map.bookmarks.length > 0) {
          view.map.bookmarks.forEach(bookmark => {
            const bookmark_btn = domConstruct.create('button', {
              className: 'btn btn-clear',
              innerHTML: bookmark.name
            });
            view.ui.add(bookmark_btn, 'top-right');
            on(bookmark_btn, 'click', () => {
              view.goTo(
                {
                  target: Extent.fromJSON(bookmark.extent)
                },
                {
                  duration: 4000,
                  easing: 'ease-in'
                }
              );
            });
          });
        }
      },

      /**
     *
     * @param layerView
     * @param time_field
     * @returns {function(*=)}
     */
      initializeHighlight: function(layerView, time_field) {
        // HIGHLIGHT //
        let highlightHandle = null;
        layerView.view.highlightOptions = {
          color: Color.named.red, // "#0079c1",
          haloOpacity: 0.5,
          fillOpacity: 0.8
        };

        this.clearHighlight = () => {
          if (highlightHandle) {
            highlightHandle.remove();
            highlightHandle = null;
          }
        };

        let query_handle = null;
        return year => {
          query_handle && !query_handle.isFulfilled() && query_handle.cancel();

          const count_query = layerView.layer.createQuery();
          count_query.outFields = [time_field];
          count_query.where = `(${time_field} >= date '${new Date(Date.parse(year)).toAGSDateTimeString()}') AND (${time_field} < date '${new Date(Date.parse(year + 1)).toAGSDateTimeString()}')`;

          query_handle = layerView.queryObjectIds(count_query).then(ids => {
            this.clearHighlight();
            highlightHandle = layerView.highlight(ids);
          });
        };
      },

      /**
     *
     * @param view
     * @param timeExtent
     */
      initializeTimeFilter: function(view, timeExtent) {
        const current_time_info = {
          min: timeExtent.min,
          max: timeExtent.max
        };

        const format_date = date_time => {
          return locale.format(date_time, {
            selector: 'date',
            datePattern: 'yyyy'
          });
        };

        const time_input = dom.byId('time-input');
        time_input.min = current_time_info.min.valueOf();
        time_input.max = current_time_info.max.valueOf();
        time_input.valueAsNumber = time_input.min;

        on(time_input, 'input', () => {
          update_time_filter();
        });
        on(time_input, 'change', () => {
          update_time_filter();
        });

        const set_time = date_time => {
          time_input.valueAsNumber = date_time;
          update_time_filter();
        };

        const update_time_filter = () => {
          dom.byId('year-node').innerHTML = format_date(
            new Date(time_input.valueAsNumber)
          );
          this.emit('time-change', { dateTimeValue: time_input.valueAsNumber });
        };
        update_time_filter();

        //
        // ANIMATION //
        //

        let animation;
        let animation_fps = this.base.config.fps || 8;

        const _startAnimation = () => {
          _stopAnimation();
          domClass.add('time-input', 'btn-disabled');
          animation = _animate(parseFloat(time_input.value));
        };

        const _stopAnimation = () => {
          if (!animation) {
            return;
          }
          animation.remove();
          animation = null;
          domClass.remove('time-input', 'btn-disabled');
          domClass.remove(play_pause_btn, 'icon-ui-pause icon-ui-red');
          domClass.add(play_pause_btn, 'icon-ui-play');
        };

        function _animate(startValue) {
          let animating = true;
          let value = startValue;

          const one_hour = 1000 * 60 * 60;
          const one_day = one_hour * 24;
          const one_month = one_day * 30;

          const frame = function() {
            if (!animating) {
              return;
            }

            value += one_month * 3;
            if (value > current_time_info.max.valueOf()) {
              value = current_time_info.min.valueOf();
              //stopAnimation();
            }
            set_time(value);

            setTimeout(
              () => {
                requestAnimationFrame(frame);
              },
              1000 / animation_fps
            );
          };

          frame();

          return {
            remove: function() {
              animating = false;
            }
          };
        }

        const play_pause_btn = dom.byId('play-pause-btn');
        on(play_pause_btn, 'click', () => {
          domClass.toggle(
            play_pause_btn,
            'icon-ui-play icon-ui-pause icon-ui-red'
          );
          if (domClass.contains(play_pause_btn, 'icon-ui-play')) {
            _stopAnimation();
          } else {
            _startAnimation();
          }
        });

        this.autoPlay = () => {
          play_pause_btn.click();
        };
      }
    });
  }
);
