<p align="center">
    <a href="https://chp-rubicell.github.io/epshape">
        <!-- <img src="https://github.com/chp-rubicell/EPEdit.js/blob/main/doc/epedit.svg" width="256" alt="EPEdit.js"><br/> -->
        <img src="./doc/epshape.svg" width="480" alt="EPEdit.js"><br/>
        <img src="https://img.shields.io/badge/-Try Out Yourself-black.svg?style=for-the-badge&colorB=9EE3FF" alt="Downloads">
    </a>
</p>

<p align="center">
    <img src="doc/screenshots/home.jpg" width="80%" />
</p>

**EPShape** is a 3D interactive web-based shape viewer for EnergyPlus Input Data Files (`.idf`) and is a crucial tool for intuitively understanding and checking the IDF model.

## Key Features

- **View IDF model shapes** : Parse the shape information (zones, surfaces, fenestrations, etc.) defined in the `.idf` file and display them in an interactive viewer.
- **Web-based** : Works in modern browsers without the need for installation or dependencies.
- **Compatibility** : Compatible with a wide range of EnergyPlus versions (8.9.0 ~).
- **Compatibility** : Inspect properties of surfaces, fenestrations, and shadings by simply mousing over objects.
- **Customization** : Offers extensive customizations for not only convenient model checking but also rendering high-quality image files fit for various purposes.

## Usage

### Basic navigation

<p align="center">
    <img src="./doc/screenshots/dragndrop.jpg" width="80%" />
    <br>
    Open an <code>.idf</code> file by simply dragging and dropping the file on to the viewer or by pressing the 'IDF File' button.
</p>

<p align="center">
    <img src="./doc/screenshots/camera.jpg" width="80%" />
    <br>
    Use the left mouse to rotate the camera and the right or middle mouse to pan the camera.
</p>

### Inspect model

<p align="center">
    <img src="./doc/screenshots/inspect.jpg" width="80%" />
    <br>
    You can mouseover any object to see its properties (name, construction, zone, etc.).
</p>

<p align="center">
    <img src="./doc/screenshots/vis-zones.jpg" width="45%" />
    <img src="./doc/screenshots/vis-height.jpg" width="45%" />
    <br>
    Toggle visibility of zones individually or by the height range.
</p>

### Customizations

<p align="center">
    <img src="./doc/screenshots/set.jpg" width="80%" />
    <br>
    Various customization options are provided.
</p>

<p align="center">
    <img src="./doc/screenshots/set-surftype.jpg" width="45%" />
    <img src="./doc/screenshots/set-const.jpg" width="45%" />
    <br>
    Materials can be customized based on either surface types or constructions.
</p>

### Additional functionalities

<p align="center">
    <img src="./doc/screenshots/copyset.jpg" width="80%" />
    <br>
    Settings can be copied and pasted for repeatability.
</p>

<p align="center">
    <img src="./doc/screenshots/cmd.jpg" width="40%" />
    <img src="./doc/screenshots/cmd-help.jpg" width="40%" />
    <br>
    Additional settings and functionalities are available via the command prompt.<br>(Type <code>help</code> for more information)
</p>

<p align="center">
    <img src="./doc/screenshots/help.jpg" width="80%" />
    <br>
    For more information, press the help ('?') button in the upper right corner.
</p>

## Acknowledgement

Made using [three.js](https://github.com/mrdoob/three.js).

## License

Distributed under the [MIT License](LICENSE).
