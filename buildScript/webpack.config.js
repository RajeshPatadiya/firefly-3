/* eslint-env node */

import webpack from 'webpack';
import ExtractTextPlugin from 'extract-text-webpack-plugin';
import UglifyJsPlugin from 'uglifyjs-webpack-plugin';
import Visualizer from 'webpack-visualizer-plugin';
import path from 'path';
import fs from 'fs';


const exclude_dirs = /(node_modules|java|python|config|test)/;

/**
 * A helper function to create the webpack config object to be sent to webpack module bundler.
 * @param {Object}  config configuration parameters used to create the webpack config object.
 * @param {string}  config.src  source directory
 * @param {string}  config.firefly_root  Firefly's build root
 * @param {string}  [config.firefly_dir]  Firefly's JS source directory
 * @param {Object}  [config.alias]  additional alias
 * @param {boolean=true} [config.use_loader]  generate a loader to load compiled JS script(s).  Defautls to true
 * @param {string}  [config.project]  project name
 * @param {string}  [config.filename]  name of the generated JS script.
 * @param {string}  [config.baseWarName]  name of the the war file base, defaults to config.name
 * @returns {Object} a webpack config object.
 */
export default function makeWebpackConfig(config) {

    // setting defaults
    config.src = config.src || process.cwd();
    config.firefly_root = config.firefly_root || path.resolve(config.src, '../..');
    config.firefly_dir = config.firefly_dir || path.resolve(config.firefly_root, 'src/firefly');
    config.project = config.project || path.resolve(config.src, '../../');
    config.baseWarName = config.baseWarName || config.name; 

    const def_config = {
        env         : process.env.NODE_ENV || 'development',
        dist        : process.env.WP_BUILD_DIR || path.resolve(config.project, `build/${config.name}/war`),
        do_lint     : process.env.DO_LINT || process.env.DO_LINT_STRICT || false,
        html_dir    : 'html',
        use_loader  : true,
        filename    : '[name]-dev.js',
        deploy_dir  : (process.env.HYDRA_ROOT || '/hydra') + `/server/tomcat/webapps/${config.baseWarName}`,
        alias       : {
            firefly : path.resolve(config.firefly_dir, 'js'),
            styles : path.resolve(config.firefly_dir, 'html', 'css'),
            html : path.resolve(config.firefly_dir, 'html')
        }
    };

    config.alias = Object.assign(def_config.alias, config.alias);
    config = Object.assign(def_config, config);

    let script_names = [];
    if (config.use_loader) {
        script_names = ['firefly_loader.js'];
    } else {
        Object.keys(config.entry).forEach( (v) => {
            script_names.push(v + '.js');
        });
    }

    const globals = {
        'process.env'   : {NODE_ENV : JSON.stringify(config.env)},
        NODE_ENV        : config.env,
        __PROPS__       : {
            SCRIPT_NAME : JSON.stringify(script_names),
            MODULE_NAME : JSON.stringify(config.name)
        }

    };

    // add all of the env that starts with '__$' as global props
    Object.keys(process.env).filter((k) => k.startsWith('__$')).forEach((k) => {
        globals.__PROPS__[k.substring(3)] = JSON.stringify(process.env[k]);
    });

    const ENV_DEV_MODE= config.env === 'development' && process.env.DEBUG;
    const ENV_PROD    = config.env !== 'development';
    const ENV_DEV     = process.env.BUILD_ENV==='dev';

    /*
     * creating the webpackConfig based on the project's config for webpack to work on.
     *
     */

    /*------------------------ OUTPUT -----------------------------*/
    const out_path = ENV_DEV_MODE ? config.deploy_dir : config.dist;
    let filename = config.use_loader ? '[name]-dev.js' : '[name].js';
    if (ENV_PROD) {
        filename = config.use_loader ? '[name]-[hash].js' : '[name].js';
    }
    const output =  {filename, path: out_path};

    /*------------------------ PLUGIINS -----------------------------*/
    const plugins = [
        new webpack.DefinePlugin(globals),
        new ExtractTextPlugin(`${config.name}.css`),
    ];
    if (ENV_DEV_MODE) {
        plugins.push( dev_progress() );
    }
    if (ENV_DEV) {
        plugins.push( new Visualizer({filename: './package-stats.html'}) );
    }

    if (config.use_loader) {
        plugins.push(
            firefly_loader(path.resolve(config.firefly_dir, '../../buildScript/loadScript.js'),
                out_path, ENV_DEV_MODE)
        );
    }

    if (ENV_PROD) {
        plugins.push(
            // if using the latest uglifyjs-webpack-plugin, based on UglifyJSv3, understanding es6 modules
            // this uglifier also minimizes the code, no LoaderOptionsPlugin is needed
            new UglifyJsPlugin({
                sourceMap : true,
                uglifyOptions: {
                    warnings: false, // false is default
                    compress: {
                        ecma: 6, // 5 is default
                        dead_code: true, // true is default
                        unused: true,    // true is default
                    },
                    output: {
                        ecma: 6
                    }
                }
            })

            // included with webpack3 is UglifyJSv2
            // https://github.com/webpack-contrib/uglifyjs-webpack-plugin/tree/version-0.4
            // new webpack.optimize.UglifyJsPlugin({
            //     sourceMap : false,
            //     compress : {
            //         warnings  : false,
            //         unused    : true,
            //         dead_code : true
            //     }
            // }),
            // new webpack.LoaderOptionsPlugin({
            //     minimize: true
            // })
        );
    }


    /*------------------------ MODULE -----------------------------*/
    const rules = [
        {   test : /\.(js|jsx)$/,
            include: [config.src, config.firefly_dir],
            loader: 'babel-loader',
            query: {
                // later presets run before earlier for each AST node
                // use 'es2015', {modules: false}] for es5 with es6 modules
                presets: [
                    ['env',
                        {
                            targets: {
                                browsers: ['safari >= 9', 'chrome >= 62', 'firefox >= 56', 'edge >= 14']
                            },
                            debug: !ENV_PROD,
                            modules: false,  // preserve application module style - in our case es6 modules
                            useBuiltIns : true
                        }
                    ],
                    'react',
                    'stage-3'],
                plugins: ['transform-runtime']
            }
        },
        {   test    : /\.css$/,
            exclude: exclude_dirs,
            use: [
                {
                    loader: 'style-loader'
                },
                {
                    loader: `css-loader?root=${path.resolve(config.firefly_dir, 'html')}`,
                },
                {
                    loader: 'postcss-loader'
                }
            ]
        },
        {   test: /\.(png|jpg|gif)$/,
            use: [{
                loader: `url-loader?root=${path.resolve(config.firefly_dir, 'html')}`,
            }]
        }
    ];

    // commented out for now.. may want to use it later on.
    // Compile CSS to its own file in production..
    // rules = rules.map((rule) => {
    //     if (/css/.test(rule.test)) {
    //         rule.use = ExtractTextPlugin.extract({fallback: rule.use[0], use: rule.use.slice(1)});
    //     }
    //    return rule;
    // });


    if (config.do_lint) {
        let eslint_options = '';
        if (process.env.DO_LINT_STRICT) {
            // in addition to .eslintrc, extra rules are defined in .eslint-strict.json
            const eslint_strict_path = path.resolve(config.project, '.eslint-strict.json');
            if (fs.existsSync(eslint_strict_path)) {
                eslint_options = '?' + JSON.stringify(JSON.parse(fs.readFileSync(eslint_strict_path)));
                console.log('eslint-loader' + eslint_options);
            } else {
                console.log('ERROR: No .eslint-strict.json found - excluding lint');
                console.log('----------------------------------------------------');
                config.do_lint = false;
            }
        }
        rules.push(
            {
                test : /\.(js|jsx)$/,
                enforce: 'pre',
                exclude: exclude_dirs,
                loader: 'eslint-loader' + eslint_options,
                options: {
                    configFile  : path.resolve(config.project,'.eslintrc'),
                    failOnError : false,
                    emitWarning : false
                }
            }
        );
    }

    const webpack_config = {
        name    : config.name,
        target  : 'web',
        devtool : 'source-map',
        entry   : config.entry,
        resolve : {
            extensions : ['.js', '.jsx'],
            alias : config.alias
        },
        module: {rules},
        output,
        plugins,
        stats: {maxModules: 0}
    };

    // console.log (JSON.stringify(webpack_config, null, 2));
    return webpack_config;
}
// ----------------------------------
// Vendor Bundle Configuration
// ----------------------------------
//webpackConfig.entry.vendor = [
//    'history',
//    'immutable',
//    'react',
//    'react-redux',
//    'react-router',
//    'redux',
//    'redux-devtools',
//    'redux-devtools/lib/react'
//];
//
//// NOTE: this is a temporary workaround. I don't know how to get Karma
//// to include the vendor bundle that webpack creates, so to get around that
//// we remove the bundle splitting when webpack is used with Karma.
//const commonChunkPlugin = new webpack.optimize.CommonsChunkPlugin(
//    'vendor', '[name].[hash].js'
//);
//commonChunkPlugin.__KARMA_IGNORE__ = true;
//webpackConfig.plugins.push(commonChunkPlugin);




function firefly_loader(loadScript, outpath, debug=true) {
    return function () {
        this.plugin('done', function (stats) {
            // console.log(Object.keys(stats.compilation));
            const hash = debug ? 'dev' : stats.hash;
            //var cxt_name = stats.compilation.name;

            let content = fs.readFileSync(loadScript);
            content = content.toString().replace('/*PARAMS_HERE*/', `'firefly_loader.js', 'firefly-${hash}.js'`);
            const loader = path.join(outpath, 'firefly_loader.js');
            fs.writeFileSync(loader, content);
        });
    };
}

function dev_progress() {
    return new webpack.ProgressPlugin(function (percent, msg) {
        //console.log(msg);
        if (msg.startsWith('compiling')) {
            process.stdout.write('\n\x1b[1;31m> Compiling new changes\x1b[0m');   // set color to red.  for more options.. import a color lib.
        }
        if  (percent === 1) {
            process.stdout.write('\x1b[0m\n');
            setTimeout(() => process.stdout.write('\n\x1b[32m\x1b[1m> Build completed: ' + new Date().toLocaleTimeString() + '\x1b[0m \n'));
        } else if (percent * 100 % 5 === 0) {
            process.stdout.write('.');
        }
    });
}

