# Touch'N'Stars: WebApp for Mobile Control of NINA

[![](https://dcbadge.limes.pink/api/server/4gZJEMWFcN)](https://discord.com/invite/4gZJEMWFcN)

[![Download on the App Store](https://tools.applemediaservices.com/api/badges/download-on-the-app-store/black/en-us?size=250x83)](https://apps.apple.com/us/app/touch-n-stars/id6744902856)

<a href="https://play.google.com/store/apps/details?id=com.TouchNStars.dev"><img alt="Get it on Google Play" src="https://play.google.com/intl/en_us/badges/static/images/badges/en_badge_web_generic.png" height="50"></a>

# 🤝 **Community-Powered, Forever Free: Donate to Cover Apple’s Developer Fee**

Our app is Open Source and will remain so - without advertising, without costs.
In order for it to be available in the Apple App Store, we need an annual developer license of 99 USD, which Apple requires.
Since we do not pursue any commercial interests, we would like to ask you, the community, for support.
If you would like to help us cover the costs, we would be happy about any donation:

👉 [paypal.me/TouchNStars](http://paypal.me/TouchNStars)

Thank you for your support! 💜

---

### 🚀 **Current Status: Stable Version**

Touch’N’Stars is a stable and fully usable application designed for astronomy enthusiasts who want to conveniently control their equipment using NINA (Nighttime Imaging ‘N’ Astronomy) via touch-enabled devices.
The app is actively maintained and continuously improved, but it is no longer in a development or experimental phase. It is ready for regular use in real imaging sessions.

### 🏁 **Purpose of the WebApp**

The application makes controlling and configuring NINA- or PINS-based astrophotography rigs easier directly from a tablet or smartphone. This makes field setup, equipment configuration, and imaging-session control more mobile and convenient.

### 🧩 **Important Notes**

- Standard Windows operation requires a running NINA installation with the latest
  **Touch-N-Stars** and **Advanced API** plugins. PINS/headless rigs are supported
  as a separate runtime mode.
- Advanced API V2 must be enabled. Its port is discovered dynamically through the
  Touch-N-Stars plugin and does not need to be fixed to `1888`.
- For Three Point Polar Alignment, version 2.2.2.0 or newer is required.
- It is intended as a complement to the desktop software and provides mobile support for basic functions.
- The author assumes no liability

### 🔧 **Installation**

- Please take a look at the instructions in our [WIKI](https://github.com/Touch-N-Stars/Touch-N-Stars/wiki/Touch'N'Stars-Wiki#-important-notes)

### 📱 **Android App**

- We have created an app for Android users.
- You can find the app on the [Google Play Store](https://play.google.com/store/apps/details?id=com.TouchNStars.dev)

### 📱 **iOS App**

- You can find the app in the [App Store](https://apps.apple.com/us/app/touch-n-stars/id6744902856)

#### Building locally on macOS

With Xcode and CocoaPods installed, run from the repository root:

```sh
npm ci
npm run ios:run
```

`ios:run` uses the Ionic CLI to build the web app and sync native plugins, then
Xcode to compile, sign, install, and launch the **App** scheme on the connected
iPhone. Unlock the phone and enable Developer Mode. If multiple devices are
connected, select one with `npm run ios:run -- "iPhone name"` or its UDID.
This also handles devices visible to Xcode/CoreDevice but missing from Ionic's
`native-run` device list. Build products are kept in `ios/DerivedData`.

To open the workspace manually instead:

```sh
npx ionic capacitor build ios --no-open
npx cap open ios
```

If the geolocation dependency needs refreshing:

```sh
cd ios/App
pod update CapacitorGeolocation IONGeolocationLib --repo-update
cd ../..
npx cap sync ios
```

Build the **App** scheme in `App.xcworkspace`. After updating native plugins,
use Xcode's **Product → Clean Build Folder** before rebuilding. Geolocation
is pinned to `8.2.3` with `IONGeolocationLib 3.0.0`. If Xcode reports missing
`trueHeading`, `magneticHeading`, or `headingAccuracy` in
`IONGLOCPositionModel+JSONTransformer`, refresh the native pods with the command
above; `cap copy` alone does not update native dependencies. If that error
persists, run `pod cache clean IONGeolocationLib --all` inside `ios/App`, repeat
the pod update, and clean the Xcode build folder again.

### 🧪 **What does the Version offer?**

- **Mobile Operation**: Easily access NINA through your smartphone or tablet.
- **User-Friendly Design**: Simple and intuitive interface specifically optimized for mobile devices.
- **Focus on Practical Features**: Support for essential steps in setting up your equipment.

### 💙 **Acknowledgements**

- Special thanks go to the entire **NINA** development team, whose excellent work enabled the creation of this web app.
- A special thank you to **Christian**, the developer of the **Advanced API**, for his efforts and support. His work has significantly enabled the development of this web app.
- [Celestia Atlas](https://github.com/acocalypso/celestia_atlas), the default offline sky renderer, licensed under MIT.
- OpenNGC catalogue data by Mattia Verga and contributors, licensed under CC-BY-SA-4.0
- Stellarium v26.2 deep-sky catalogue cross-index data, used for the bundled Abell/ACO, Barnard, LBN, LDN, RCW, Sharpless 2 and vdB supplement, licensed under GPL-2.0-or-later
- HYG Database v4.1 by David Nash/Astronomy Nexus, used for the bundled HYG star layer, licensed under CC-BY-SA-4.0
- General Catalogue of Variable Stars 5.1 by the GCVS team, used for 63,291 offline searchable named-variable entries; see the pinned Atlas notice for attribution and source terms.
- SIMBAD A66/Abell planetary-nebula catalogue data, licensed under ODbL-1.0. This research has made use of the SIMBAD database, operated at CDS, Strasbourg, France.
- Detailed source, transformation and redistribution notices are retained in the pinned [Celestia Atlas third-party notices](https://github.com/acocalypso/celestia_atlas/blob/777b2a6b9a23de04d4a4c4effc8384eff1cb7566/THIRD_PARTY_NOTICES.md)

### 🔍 Further information

- Visit our website: https://touch-n-stars.eu
- You can find more details about the application and how to use it in our [WIKI](https://github.com/Touch-N-Stars/Touch-N-Stars/wiki/Touch'N'Stars-Wiki).
- Our [YouTube channel](https://www.youtube.com/watch?v=0chtlhO_cX4&list=PLAT-Qw0mxhRLn1KzFKGRuu3Pur-gjNS2C) has video instructions and further tips on how to use Touch'N'Stars
- Developers can start with the [contribution guide](CONTRIBUTING.md), [high-level design](HighLevelDesign.md), and [Celestia Atlas integration guide](docs/celestia-atlas-integration.md).

## 🤝 Contributing

Contributions are **very welcome**.
Whether you are a developer, tester, designer, translator, or simply an astronomy enthusiast with ideas or feedback — everyone is invited to participate and help improve Touch’N’Stars.

You can contribute by:

- Reporting bugs or issues
- Suggesting new features or improvements
- Improving documentation or translations
- Submitting pull requests

Please feel free to open an issue or start a discussion before working on larger changes.  
All contributions are appreciated and help make the project better for the entire community.
