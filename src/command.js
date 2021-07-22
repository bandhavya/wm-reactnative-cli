const fs = require('fs-extra');
const logger = require('./logger');
const plist = require('plist');
const path = require('path');
const android = require('./android');
const { showConfirmation } = require('./requirements');

const {
    exec
} = require('./exec');

const {
    hasValidNodeVersion,
    hasValidJavaVersion,
    checkForGradleAvailability,
    isGitInstalled,
    hasYarnPackage,
    hasValidRNVersion,
    hasValidExpoVersion
 } = require('./requirements');

 const config = require('./config');
 const { invokeiosBuild } = require('./ios');
const { resolve } = require('path');
const loggerLabel = 'wm-reactnative-cli';

function getFileSize(path) {
    const stats = path && fs.statSync(path);
    return (stats && stats['size']) || 0;
}

function updateExpoplistFile() {
    const iosPath =  config.src + 'ios';
    var filename = fs.readdirSync(iosPath).filter(v => {
        return v.endsWith('.xcodeproj') || v.endsWith('.xcworkspace');
    });
    filename = filename[0].replace('.xcworkspace', '').replace('.xcodeproj', '');
    const plistPath = iosPath + '/' + filename + '/Supporting/Expo.plist';

    var obj = plist.parse(fs.readFileSync(plistPath, 'utf8'));
    obj['EXUpdatesURL'] = 'https://wavemaker.com'; // update with some dummy url
    fs.writeFileSync(plistPath, plist.build(obj))
}

async function updatePackageJsonFile(path) {
    return await new Promise(resolve => {
        try {
            fs.readFile(path, async function(error, data) {
                if (error) {
                    throw error;
                }
                var jsonData = JSON.parse(data);
                jsonData['main'] = "index";
                await fs.writeFile(path, JSON.stringify(jsonData), error => {
                    if (error) {
                        throw error;
                    }
                    logger.info({
                        'label': loggerLabel,
                        'message': 'updated package.json file'
                    });
                    resolve('success');
                });
            })
        } catch (e) {
            resolve('error', e);
        }
    })
}

async function updateAppJsonFile(content, appId, src) {
    return await new Promise(resolve => {
        try {
            const path = (src || config.src) + 'app.json';
            if (fs.existsSync(path)) {
                fs.readFile(path, async function(error, data) {
                    if (error) {
                        throw error;
                    }
                    var jsonData = JSON.parse(data);
                    if (content) {
                        Object.assign(jsonData['expo'], content);
                    }
                    if (appId) {
                        jsonData['expo']['android']['package'] = appId;
                        jsonData['expo']['ios']['bundleIdentifier'] = appId;
                    }
                    await fs.writeFile(path, JSON.stringify(jsonData), error => {
                        if (error) {
                            throw error;
                        }
                        resolve('success');
                        logger.info({
                            'label': loggerLabel,
                            'message': 'updated app.json file'
                        });
                    })
                });
            }
        } catch (e) {
            resolve('error', e);
        }
    })
}

 async function build(args) {
     if (!args.autoEject) {
        const response = await showConfirmation('Would you like to eject the expo project (yes/no) ?');
        if (response !== 'y' && response !== 'yes') {
            process.exit();
        }
     }
     config.metaData = await readWmRNConfig(args.src);
     config.platform = args.platform;
     let response;
     if (args.dest) {
        args.dest = path.resolve(args.dest) + '/';
        if (!config.metaData.ejected) {
            response = await ejectProject(args);
        }
    } else {
        response = await ejectProject(args);
    }

    if (response && response.errors) {
        return response;
    }

    if (args.dest) {
        config.src = args.dest;
    }
    config.outputDirectory = config.src + 'output/';
    fs.mkdirSync(config.outputDirectory, {
        recursive: true
    });
    config.logDirectory = config.outputDirectory + 'logs/';
    fs.mkdirSync(config.logDirectory, {
        recursive: true
    });
    logger.setLogDirectory(config.logDirectory);
    logger.info({
        label: loggerLabel,
        message: `Building at : ${config.src}`
    });

    try {
        let result;
        if (config.platform === 'android') {
            result = await android.invokeAndroidBuild(args);
        } else if (config.platform === 'ios') {
            updateExpoplistFile();

            await exec('pod', ['install'], {
                cwd: config.src + 'ios'
            });
            result = await invokeiosBuild(args);
        }
        if (result.errors && result.errors.length) {
            logger.error({
                label: loggerLabel,
                message: args.platform + ' build failed due to: \n\t' + result.errors.join('\n\t')
            });
        } else if (!result.success) {
            logger.error({
                label: loggerLabel,
                message: args.platform + ' BUILD FAILED'
            });
        } else {
            logger.info({
                label: loggerLabel,
                message: `${args.platform} BUILD SUCCEEDED. check the file at : ${result.output}.`
            });
            logger.info({
                label: loggerLabel,
                message: `File size : ${Math.round(getFileSize(result.output) * 100 / (1024 * 1024)) / 100} MB.`
            });
        }
        return result;
    } catch(e) {
        logger.error({
            label: loggerLabel,
            message: 'BUILD Failed. Due to :' + e
        });
        return {
            success : false,
            errors: e
         };
    }
}

async function setupBuildDirectory(src, dest) {
    const target = dest;
    if (fs.existsSync(target)) {
        if (fs.readdirSync(target).length) {
            const response = await showConfirmation('Would you like to empty the dest folder (i.e. ' + dest + ') (yes/no) ?');
            if (response !== 'y' && response !== 'yes') {
                process.exit();
            }
            // using removeSync when target is directory and unlinkSync works when target is file.
            const fsStat = fs.lstatSync(target);
            if (fsStat.isDirectory()) {
                fs.removeSync(target);
            } else if (fsStat.isFile()) {
                fs.unlinkSync(target);
            }
        }
    }
    fs.mkdirsSync(target);
    fs.copySync(src, dest);
}

async function getDefaultDestination() {
    const id = config.metaData.id;
    const version = '1.0.0';
    const path = `${require('os').homedir()}/.wm-reactnative-cli/build/${id}/${version}/`;
    fs.mkdirSync(path, {
        recursive: true
    });
    let next = 1;
    if (fs.existsSync(path)) {
        next = fs.readdirSync(path).reduce((a, f) => {
            try {
                const c = parseInt(f);
                if (a <= c) {
                    return c + 1;
                }
            } catch(e) {
                //not a number
            }
            return a;
        }, next);
    }
    const dest = path + '/' + next;
    fs.mkdirSync(dest, {
        recursive: true
    });
    return dest;
}

async function readWmRNConfig(src) {
    src = path.resolve(src) + '/';
    let jsonPath = src + 'wm_rn_config.json';
    let data = await fs.readFileSync(jsonPath);
    return JSON.parse(data);
}

async function writeWmRNConfig(content) {
    src = path.resolve(config.src) + '/';
    let jsonPath = src + 'wm_rn_config.json';
    let data = await fs.readFileSync(jsonPath);
    data = JSON.parse(data);
    if (content) {
        Object.assign(data, content);
    }
    await fs.writeFile(jsonPath, JSON.stringify(data), error => {
        if (error) {
            throw error;
        }
        logger.info({
            'label': loggerLabel,
            'message': 'updated wm_rn_config.json file'
        })
    })
}

// src points to unzip proj
async function ejectProject(args) {
    try {
        let folderName = args.src.split('/').pop();
        const isZipFile = folderName.endsWith('.zip');

        folderName = isZipFile ? folderName.replace('.zip', '') : folderName;

        const tmp = `${require('os').homedir()}/.wm-reactnative-cli/temp/${folderName}/${Date.now()}`;

        if (args.src.endsWith('.zip')) {
            const zipFile = args.src;
            args.src = tmp + '/src';

            if (!fs.existsSync(args.src)) {
                fs.mkdirsSync(args.src);
            }

            await exec('unzip', [
                '-o',
                zipFile,
                '-d',
                args.src
            ]);
        }
        args.src = path.resolve(args.src) + '/';

        if(!args.dest) {
            args.dest = await getDefaultDestination(args.appId);
        }
        args.dest = path.resolve(args.dest)  + '/';

        if(args.src === args.dest) {
            logger.error({
                label: loggerLabel,
                message: 'source and destination folders are same. Please choose a different destination.'
            });
        }
        await setupBuildDirectory(args.src, args.dest);
        config.src = args.dest;
        logger.info({
            label: loggerLabel,
            message: 'destination folder where app is build at ' + args.dest
        })
    if (!args.platform) {
        args.platform = 'android';
    }
    config.platform = args.platform;
    config.buildType = args.buildType;

    if (!await hasValidNodeVersion() || !await hasValidJavaVersion() || !await hasYarnPackage() ||
        !await checkForGradleAvailability() || !await isGitInstalled() || !await hasValidExpoVersion()) {
        return {
            errors: 'check if all prerequisites are installed.',
            success: false
        }
    }
    await updateAppJsonFile({
        'name': config.metaData.name,
        'slug': config.metaData.name
    }, config.metaData.id, config.src);
    await updatePackageJsonFile(config.src + 'package.json');
    await exec('yarn', ['install'], {
        cwd: config.src
    });
    if (args.localrnruntimepath) {
        const linkFolderPath = config.src + 'node_modules/@wavemaker/app-rn-runtime';
        // using removeSync when target is directory and unlinkSync works when target is file.
        if (fs.existsSync(linkFolderPath)) {
            fs.removeSync(linkFolderPath);
        }
        await fs.mkdirsSync(linkFolderPath);
        await fs.copySync(args.localrnruntimepath, linkFolderPath);
        logger.info({
            'label': loggerLabel,
            'message': 'copied the app-rn-runtime folder'
        })
    }
    // expo eject checks whether src is a git repo or not
    await exec('git', ['init'], {
        cwd: config.src
    });
    logger.info({
        'label': loggerLabel,
        'message': 'invoking expo eject'
    });
    await exec('expo', ['eject'], {
        cwd: config.src
    });
    logger.info({
        'label': loggerLabel,
        'message': 'expo eject succeeded'
    });
    await writeWmRNConfig({ejected: true});
} catch (e) {
    logger.error({
        label: loggerLabel,
        message: args.platform + ' eject project Failed. Due to :' + e
    });
    return { errors: e, success : false };
}
}

module.exports = {
    ejectProject: ejectProject,
    build: build
}
