# wm-reactnative-cli

A command line utility to build react native apps created using WaveMaker product.

The main goal of wm-reactnative-cli is to simplify generation of APK or IPA for WaveMaker developers. ```wm-reactnative-cli``` combines multiple react-native commands into a single command. First, one has to make sure all the required hardware and software are available and installed. Then execute the command with the appropriate values for arguments.


## Android Build

### Requirements

-   Linux or MAC or Windows
-   Node 12.x ([https://nodejs.org/en/blog/release/v12.22.0/](https://nodejs.org/en/download/))
-   GIT ([https://git-scm.com/download](https://git-scm.com/download))
-   Java 8
-   Yarn
-   Gradle 6 ([https://gradle.org/releases/](https://gradle.org/releases/))
-   Expo cli 4.7.3 (npm install -g expo-cli@4.7.3)
-   react-native 0.63.4 (npm install -g react-native-cli@0.63.4)
-   Make sure JAVA_HOME, ANDROID_SDK and GRADLE_HOME are set in the environment variables and also in PATH.

### Command

wm-reactnative android <src_dir> [additional_arguments]


|&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;**Argument**&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;| **Description** |
|--|--|
| **src_dir** | **DEFAULT:** current working directory.<br> Path to the reactnative zip (or) path to the reactnative project folder. |
|**\-\-appId:** application id.|
| **\-\-localrnruntimepath** |**OPTIONAL:** local app-rn-runtime path |
|**\-\-dest**|**OPTIONAL:** directory where the app has to be copied and built. If it is not specified then .wm-reactnative-cli folder inside the home directory, will contain the build folders |
|**\-\-auto-eject**|**OPTIONAL:** On setting this flag to true, expo eject will be invoke automatically.|
|**\-\-aKeyStore**|Absolute path of the key store. If keystore is not given then android debug key is used.|
|**\-\-aStorePassword**|Password to key store|
|**\-\-aKeyAlias**|Alias name of the key|
|**\-\-aKeyPassword**|Key Password|
|**\-\-packageType**|**DEFAULT:** development<br>development or production<br>Use ‘production’ with keystore specified.|


### Example 1

~~~
wm-reactnative build android "/path/to/src" --appId="app_id"
~~~
### Example 2
~~~
wm-cordova build android "/path/to/src" \
--dest="/path/to/dest" \
--aKeyStore="/path/to/file.keystore" \
--aStorePassword="store_password" \
--aKeyAlias="key_alias_name" \
--aKeyPassword="key" \
--packageType="production"
--auto-eject=true
~~~

## IOS build

### Requirements

-   MAC machine
-   Latest XCODE
-   CocoaPods ([https://guides.cocoapods.org/using/getting-started.html#toc_3](https://guides.cocoapods.org/using/getting-started.html#toc_3))
-   Node 10.x ([https://nodejs.org/en/blog/release/v10.18.0/](https://nodejs.org/en/download/))
-   GIT ([https://git-scm.com/download/mac](https://git-scm.com/download/mac))
-   Yarn
-   Expo cli 4.7.3 (npm install -g expo-cli@4.7.3)
-   react-native 0.63.4 (npm install -g react-native-cli@0.63.4)
-   Apple developer or distribution P12 certificates
-   Provisioning profile
-   Install wm-reactnative-cli (npm install -g @wavemaker/wm-reactnative-cli)
-   For development build, development certificate and development provisioning file are required.
-   For production build, distribution certificate and distribution provisioning file are required.

**NOTE:** Before building an app, please make sure that neither iPhone nor iPad is not connected to Mac. This is open [issue](https://github.com/apache/cordova-ios/issues/420) on cordova-ios.

### Command

wm-reactnative build ios <src_dir> [additional_arguments]


|&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;**Argument**&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;| **Description** |
|--|--|
| **src_dir** | **DEFAULT:** current working directory.<br> Path to the cordova zip (or) path to the cordova project folder. |
|**\-\-appId:** application id.|
| **\-\-localrnruntimepath** |**OPTIONAL:** local app-rn-runtime path |
|**\-\-dest**|**OPTIONAL:** directory where the app has to be copied and built. If it is not specified then .wm-reactnative-cli folder inside the home directory, will contain the build folders |
|**\-\-auto-eject**|**OPTIONAL:** On setting this flag to true, expo eject will be invoke automatically.|
|**\-\-iCertificate**|Absolute path of P12 certificate location|
|**\-\-iCertificatePassword**|Password to unlock the certificate.|
|**\-\-iProvisioningFile**|Absolute path of provisioning file|
|**\-\-iCodeSigningIdentity**|Signing certificate name in keychain access|
|**\-\-packageType**|**DEFAULT:** development<bR>development or production <br>Use ‘production’ with an AppStore distribution certificate.|


### Example


~~~
wm-cordova build ios "/path/to/src" \
--iCertificate="/path/to/distribution.p12" \
--iCertificatePassword="unlock_password" \
--iProvisioningFile="/path/to/profile.mobileprovision" \
--iCodeSigningIdentity="certificate name in keychain access" \
--packageType="production"
~~~


## Additional Information

1. Destination folder path is logged at the start of the build.
2. Build log files are present at <destination_folder>/output/logs
3. The artifact built is available at <destination_folder>/output/<platform_type>/. The complete path is printed in log also.
