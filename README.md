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
    <img src="./doc/screenshots/inspect.jpg" width="80%" />
    <br>
    You can mouseover any object to see its properties (name, construction, zone, etc.).
</p>


## Acknowledgement

Made using [three.js](https://github.com/mrdoob/three.js).

## License

Distributed under the [MIT License](LICENSE).
