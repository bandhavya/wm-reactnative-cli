const execa = require('execa');
const fs = require('fs-extra');
const logger = require('./logger');
const config = require('./config');
const path = require('path');
const plist = require('plist');

const {
    exec
} = require('./exec');
const {
    hasValidNodeVersion,
    isGitInstalled,
    isCocoaPodsIstalled,
    validateForIos
 } = require('./requirements');

 const loggerLabel = 'Generating ipa file';

async function importCertToKeyChain(keychainName, certificate, certificatePassword) {
    await exec('security', ['create-keychain', '-p', keychainName, keychainName], {log: false});
    await exec('security', ['unlock-keychain', '-p', keychainName, keychainName], {log: false});
    await exec('security', ['set-keychain-settings', '-t', '3600', keychainName], {log: false});
    let keychains = await exec('security', ['list-keychains', '-d', 'user'], {log: false});
    keychains = keychains.map(k => k.replace(/[\"\s]+/g, '')).filter(k => k !== '');
    await exec('security', ['list-keychains', '-d', 'user', '-s', keychainName, ...keychains], {log: false});
    await exec('security', 
        ['import',  
        certificate,  
        '-k', keychainName,
        '-P', certificatePassword,
        '-T', '/usr/bin/codesign',
        '-T', '/usr/bin/productsign',
        '-T', '/usr/bin/productbuild',
        '-T', '/Applications/Xcode.app'], {log: false});
    await exec('security', ['set-key-partition-list', '-S', 'apple-tool:,apple:,codesign', '-s', '-k', keychainName, keychainName], {log: false});
    logger.info({
        label: loggerLabel,
        message: `Cerificate at (${certificate}) imported in (${keychainName})`
    });
    return async () => {
        keychains = keychains.map(k => k.replace(/[\"\s]+/g, ''));
        await exec('security', ['list-keychains', '-d', 'user', '-s', ...keychains], {log: false});
        await deleteKeyChain(keychainName);
        logger.info({
            label: loggerLabel,
            message: `removed keychain (${keychainName}).`
        });
    };
}

async function deleteKeyChain(keychainName) {
    await exec('security', ['delete-keychain', keychainName]);
}


async function extractUUID(provisionalFile) {
    const content = await exec('grep', ['UUID', '-A1', '-a', provisionalFile], {log: false});
    return content.join('\n').match(/[-A-F0-9]{36}/i)[0];
}

async function getLoginKeyChainName() {
    const content = await exec('security list-keychains | grep login.keychain', null, {
        shell: true
    });
    return content[0].substring(content[0].lastIndexOf('/') + 1, content[0].indexOf('-'));
}

async function extractTeamId(provisionalFile) {
    const content = await exec('grep', ['TeamIdentifier', '-A2', '-a', provisionalFile], {log: false});
    return content[2].match(/>[A-Z0-9]+/i)[0].substr(1);
}

async function getUsername() {
    const content = await exec('id', ['-un'], false);
    return content[0];
}

async function getPackageType(provisionalFile) {
    const data = await pparse(provisionalFile);
    //data.
    if (data.type === 'appstore') {
        return 'app-store';
    }
    if (data.type === 'inhouse') {
        return 'enterprise';
    } 
    if (data.type === 'adhoc') {
        return 'ad-hoc';
    }
    throw new Error('Not able find the type of provisioning file.');
}

function setMetaInfo() {
    config.src = path.resolve(config.src) + '/';
    const jsonPath = config.src + 'app.json';
    let data = fs.readFileSync(jsonPath);
    console.log(data);
    config.metaData = JSON.parse(data);
}

function getAppName() {
    return config.metaData['expo']['name'];
}
function getAppId() {
    return config.metaData['expo']['ios']['bundleIdentifier'];
}

async function invokeiosBuild(args) {
    setMetaInfo();

    const certificate = args.iCertificate;
    const certificatePassword = args.iCertificatePassword;
    const provisionalFile = args.iProvisioningFile;
    const packageType = args.packageType;
    if (!await hasValidNodeVersion() || !await isGitInstalled() || !await isCocoaPodsIstalled()) {
        return {
            success: false
        }
    }
    const errors = validateForIos(certificate, certificatePassword, provisionalFile, packageType);
        if (errors.length > 0) {
            return {
                success: false,
                errors: errors
            }
        }
        const random = Date.now();
        const username = await getUsername();
        const keychainName = `wm-reactnative-${random}.keychain`;
        const provisionuuid =  await extractUUID(provisionalFile);
        let useModernBuildSystem = 'YES';
        logger.info({
            label: loggerLabel,
            message: `provisional UUID : ${provisionuuid}`
        });
        const codeSignIdentity = packageType === 'production' ? "iPhone Distribution" : "iPhone Developer";
        const developmentTeamId = await extractTeamId(provisionalFile);
        logger.info({
            label: loggerLabel,
            message: `developmentTeamId : ${developmentTeamId}`
        });
        const ppFolder = `/Users/${username}/Library/MobileDevice/Provisioning\ Profiles`;
        fs.mkdirSync(ppFolder, {
            recursive: true
        })
        const targetProvisionsalPath = `${ppFolder}/${provisionuuid}.mobileprovision`;
        const removeKeyChain = await importCertToKeyChain(keychainName, certificate, certificatePassword);
        // fs.copyFileSync(provisionalFile, targetProvisionsalPath);
        // logger.info({
        //     label: loggerLabel,
        //     message: `copied provisionalFile (${provisionalFile}).`
        // });
        try {
            await xcodebuild(args.iCodeSigningIdentity, provisionuuid, developmentTeamId);
        } finally {
            await removeKeyChain();
        }
}


async function updateInfoPlist(appName, PROVISIONING_UUID) {
    return await new Promise(resolve => {
        try {
        const appId = getAppId();

        const infoPlistpath = config.src + 'ios/build/' + appName +'.xcarchive/Info.plist';
         fs.readFile(infoPlistpath, async function (err, data) {
            const content = data.toString().replace('<key>ApplicationProperties</key>',
                `<key>compileBitcode</key>
            <true/>
            <key>provisioningProfiles</key>
            <dict>
                <key>${appId}</key>
                <string>${PROVISIONING_UUID}</string>
            </dict>
            <key>ApplicationProperties</key>
            `);
            await fs.writeFile(infoPlistpath, Buffer.from(content));
            resolve('success');
        });
    } catch (e) {
        resolve('error', e);
    }
    });
}

async function xcodebuild(CODE_SIGN_IDENTITY_VAL, PROVISIONING_UUID, DEVELOPMENT_TEAM) {
    const appName = getAppName();
    await execa('xcodebuild', ['-workspace', appName + '.xcworkspace', '-scheme', appName, '-configuration', 'Release', 'CODE_SIGN_IDENTITY=' + CODE_SIGN_IDENTITY_VAL, 'PROVISIONING_PROFILE=' + PROVISIONING_UUID, 'DEVELOPMENT_TEAM=' +  DEVELOPMENT_TEAM, 'CODE_SIGN_STYLE=Manual'], {
        cwd: config.src + 'ios'
    });

    await execa('xcodebuild', ['-workspace', appName + '.xcworkspace', '-scheme', appName, '-configuration', 'Release', '-archivePath', 'build/' + appName + '.xcarchive',  'CODE_SIGN_IDENTITY=' + CODE_SIGN_IDENTITY_VAL, 'PROVISIONING_PROFILE=' + PROVISIONING_UUID, 'archive', 'CODE_SIGN_STYLE=Manual'], {
        cwd: config.src + 'ios'
    });

    const status = await updateInfoPlist(appName, PROVISIONING_UUID);
    if (status === 'success') {
        await execa('xcodebuild', ['-exportArchive', '-archivePath', 'build/' + appName + '.xcarchive', '-exportOptionsPlist', 'build/' + appName + '.xcarchive/Info.plist', '-exportPath', 'build'], {
            cwd: config.src + 'ios'
        });
    }
    
}

module.exports = {
    invokeiosBuild: invokeiosBuild
}