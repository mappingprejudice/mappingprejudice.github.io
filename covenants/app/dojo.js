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

(function() {
  const _a = window.location;
  const pathname = _a.pathname;
  const search = _a.search;
  const dojoLocale = search.match(/locale=([\w-]+)/) ? RegExp.$1 : undefined;
  const config = {
    async: true,
    locale: dojoLocale,

    has: { 'esri-featurelayer-webgl': 1 },
    packages: [
      { name: 'config', location: _a + 'covenants/config' },
      {
        name: 'ApplicationBase',
        location: _a + 'js/application-base-js/',
        main: 'ApplicationBase'
      },
      { name: 'Application', location: _a + 'covenants/app', main: 'Main' }
    ]
  };
  window['dojoConfig'] = config;
})();
