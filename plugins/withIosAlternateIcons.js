// Eigenständiger, iOS-only Config-Plugin für alternative App-Icons.
//
// Warum nicht einfach expo-dynamic-app-icon als Plugin eintragen? Dessen
// withDynamicIcon() konfiguriert IMMER beide Plattformen zugleich und würde
// eigene activity-alias-Einträge (`{package}.MainActivity{iconName}`) ins
// AndroidManifest schreiben - das Android-Icon/Name-Umschalten ist hier
// aber schon vollständig und getestet über react-native-change-icon +
// handgepflegte activity-alias-Einträge gelöst (siehe AndroidManifest.xml,
// features/settings/app-icon.ts), inkl. Namens-Wechsel, den
// expo-dynamic-app-icon gar nicht unterstützt. Ein zweites, paralleles
// Android-Icon-System wäre nur Verwirrung und Konfliktrisiko.
// Diese Datei übernimmt daher NUR die iOS-Teile aus expo-dynamic-app-icon
// 1.2.0 (withIconXcodeProject/withIconInfoPlist/withIconIosImages, MIT-
// lizenziert), 1:1 der Bibliothek nachgebaut, aber ohne die Android-Mods.
// Die JS-Laufzeit (setAppIcon/getAppIcon aus expo-dynamic-app-icon) bleibt
// unverändert nutzbar - der native iOS-Modul-Code kümmert sich nicht darum,
// welcher Plugin die Info.plist/Xcode-Assets erzeugt hat.
const { withXcodeProject, withInfoPlist, withDangerousMod, IOSConfig } = require('@expo/config-plugins');
const { generateImageAsync } = require('@expo/image-utils');
const fs = require('fs');
const path = require('path');
const pbxFile = require('xcode/lib/pbxFile');

const IOS_FOLDER_NAME = 'DynamicAppIcons';
const IOS_SIZE = 60;
const IOS_SCALES = [2, 3];
// ITMS-90892: Apple verlangt für Alternate-Icons auch iPad-spezifische
// Größen (76pt@2x=152x152, 83.5pt@2x=167x167 für iPad Pro), sonst meldet
// die Validierung nach jeder Auslieferung eine "Missing recommended icon"-
// Warnung (Submission Build 24, 2026-07-20). Nur @2x, da iPad kein @3x kennt.
const IPAD_SIZES = [
  { size: 76, scales: [2] },
  { size: 83.5, scales: [2] },
];

function getIconName(name, size, scale) {
  const fileName = `${name}-Icon-${size}x${size}`;
  return scale != null ? `${fileName}@${scale}x.png` : fileName;
}

async function iterateIconsAsync(icons, callback) {
  const entries = Object.entries(icons);
  for (let i = 0; i < entries.length; i++) {
    await callback(entries[i][0], entries[i][1], i);
  }
}

function withIconXcodeProject(config, { icons }) {
  return withXcodeProject(config, async (config) => {
    const groupPath = `${config.modRequest.projectName}/${IOS_FOLDER_NAME}`;
    const group = IOSConfig.XcodeUtils.ensureGroupRecursively(config.modResults, groupPath);
    const project = config.modResults;
    const groupId = Object.keys(project.hash.project.objects['PBXGroup']).find(
      (id) => project.hash.project.objects['PBXGroup'][id].name === group.name,
    );
    if (!project.hash.project.objects['PBXVariantGroup']) project.hash.project.objects['PBXVariantGroup'] = {};
    const variantGroupId = Object.keys(project.hash.project.objects['PBXVariantGroup']).find(
      (id) => project.hash.project.objects['PBXVariantGroup'][id].name === group.name,
    );
    for (const child of [...(group.children || [])]) {
      const file = new pbxFile(path.join(group.name, child.comment), {});
      project.removeFromPbxBuildFileSection(file);
      project.removeFromPbxFileReferenceSection(file);
      if (groupId) project.removeFromPbxGroup(file, groupId);
      else if (variantGroupId) project.removeFromPbxVariantGroup(file, variantGroupId);
      project.removeFromPbxResourcesBuildPhase(file);
    }
    await iterateIconsAsync(icons, async (key) => {
      const addFile = (iconFileName) => {
        if (!group?.children.some(({ comment }) => comment === iconFileName)) {
          config.modResults = IOSConfig.XcodeUtils.addResourceFileToGroup({
            filepath: path.join(groupPath, iconFileName),
            groupName: groupPath,
            project: config.modResults,
            isBuildFile: true,
            verbose: true,
          });
        }
      };
      for (const scale of IOS_SCALES) addFile(getIconName(key, IOS_SIZE, scale));
      for (const { size, scales } of IPAD_SIZES) {
        for (const scale of scales) addFile(getIconName(key, size, scale));
      }
    });
    return config;
  });
}

function withIconInfoPlist(config, { icons }) {
  return withInfoPlist(config, async (config) => {
    const iphoneAltIcons = {};
    const ipadAltIcons = {};
    await iterateIconsAsync(icons, async (key, icon) => {
      iphoneAltIcons[key] = {
        CFBundleIconFiles: [getIconName(key, IOS_SIZE)],
        UIPrerenderedIcon: !!icon.prerendered,
      };
      ipadAltIcons[key] = {
        // iPad braucht zusätzlich zur iPhone-Größe die eigenen iPad-
        // Idiom-Größen (ITMS-90892), sonst fehlt der Validierung 167x167/
        // 152x152 obwohl das 60pt-Icon bereits im Bundle liegt.
        CFBundleIconFiles: [getIconName(key, IOS_SIZE), ...IPAD_SIZES.map(({ size }) => getIconName(key, size))],
        UIPrerenderedIcon: !!icon.prerendered,
      };
    });
    function applyToPlist(plistKey, altIcons) {
      if (typeof config.modResults[plistKey] !== 'object' || Array.isArray(config.modResults[plistKey]) || !config.modResults[plistKey]) {
        config.modResults[plistKey] = {};
      }
      config.modResults[plistKey].CFBundleAlternateIcons = altIcons;
      config.modResults[plistKey].CFBundlePrimaryIcon = { CFBundleIconFiles: ['AppIcon'] };
    }
    applyToPlist('CFBundleIcons', iphoneAltIcons);
    applyToPlist('CFBundleIcons~ipad', ipadAltIcons);
    return config;
  });
}

function withIconIosImages(config, props) {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const iosRoot = path.join(config.modRequest.platformProjectRoot, config.modRequest.projectName);
      await fs.promises.rm(path.join(iosRoot, IOS_FOLDER_NAME), { recursive: true, force: true }).catch(() => null);
      await fs.promises.mkdir(path.join(iosRoot, IOS_FOLDER_NAME), { recursive: true });
      const writeIcon = async (key, icon, iconFileName, scaledSize) => {
        const outputPath = path.join(iosRoot, IOS_FOLDER_NAME, iconFileName);
        const { source } = await generateImageAsync(
          { projectRoot: config.modRequest.projectRoot, cacheType: 'salati-ios-alternate-icons' },
          {
            name: iconFileName,
            src: icon.image,
            removeTransparency: true,
            backgroundColor: '#ffffff',
            resizeMode: 'cover',
            width: scaledSize,
            height: scaledSize,
          },
        );
        await fs.promises.writeFile(outputPath, source);
      };
      await iterateIconsAsync(props.icons, async (key, icon) => {
        for (const scale of IOS_SCALES) {
          await writeIcon(key, icon, getIconName(key, IOS_SIZE, scale), scale * IOS_SIZE);
        }
        for (const { size, scales } of IPAD_SIZES) {
          for (const scale of scales) {
            await writeIcon(key, icon, getIconName(key, size, scale), Math.round(scale * size));
          }
        }
      });
      return config;
    },
  ]);
}

module.exports = function withIosAlternateIcons(config, icons) {
  config = withIconXcodeProject(config, { icons });
  config = withIconInfoPlist(config, { icons });
  config = withIconIosImages(config, { icons });
  return config;
};
