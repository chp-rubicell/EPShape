---
title: 'EPShape: EnergyPlus Shape Viewer'
tags:
  - EnergyPlus
  - Shape viewer
  - IDF
  - Geometry
  - JavaScript
  - Web tool
authors:
  - given-names: Chul-Hong
    surname: Park
    orcid: 0009-0003-4716-8169
    affiliation: 1
affiliations:
 - name: Department of Architecture and Architectural Engineering, College of Engineering, Seoul National University, South Korea
   index: 1
date: 29 March 2026
bibliography: paper.bib
---

# Summary

EPShape ([https://chp-rubicell.github.io/epshape](https://chp-rubicell.github.io/epshape)) is an open-source, web-based application designed for the visualization and inspection of EnergyPlus [@energyplus] building energy models. It offers a range of view customization capabilities that enable comprehensive shape analysis, effective model inspection, and highly configurable renderings suitable for various analytical and presentation purposes. EnergyPlus Input Data Files (`.idf`) can be parsed by simply dragging and dropping them onto the viewer, allowing users to examine building geometry as well as various model components and properties (e.g., thermal zones, surfaces, fenestrations, and constructions).

![EPShape screenshot.\label{fig:hero}](hero.png){ width=70% }

# Statement of need

EnergyPlus is a powerful, open-source, whole-building energy simulation engine developed and maintained by the U.S. Department of Energy (DOE). It is designed to model a building's energy consumption (including heating, cooling, lighting, ventilation, and plug loads) as well as its water use. It is widely applied across a range of use cases, including building design optimization, model predictive HVAC control, code compliance, and retrofit analysis.

Despite its capabilities, EnergyPlus presents notable usability challenges. As a console-based engine, it relies on the EnergyPlus Input Data File (IDF), a text-based format, for model definition. The IDF format follows a flat, sequential architecture without any hierarchical organization. As a result, dependencies between properties (e.g., thermal zones, building surfaces, and constructions) are not explicitly represented, requiring jumping back and forth to identify related entities, which makes model interpretation highly unintuitive. This difficulty is further exacerbated for geometric data, where each surface is defined by a series of vertices specified in three-dimensional Cartesian coordinates (X, Y, Z), making direct comprehension impractical without dedicated visualization tools.

Despite these challenges, there has been a notable lack of accessible tools within the building energy modeling domain capable of directly and easily visualizing and inspecting `.idf` files. While existing modeling tools such as DesignBuilder [@designbuilder], OpenStudio [@openstudio], and Rhino with Honeybee [@roudsari2013ladybug] offer integrated viewers and inspectors for modeling purposes, these programs exhibit several limitations, including restricted support for externally generated `.idf` files, substantial installation and configuration requirements, and, in some cases, paid licensing constraints. Furthermore, variations in IDF formats across EnergyPlus versions frequently result in compatibility issues, requiring multiple separate installations to support different EnergyPlus versions.

EPShape was developed to address these limitations. EPShape is a lightweight, web-based application that works in modern web browsers without the need for installation or dependencies. It supports a broad range of EnergyPlus versions (tested for 8.9.0 and later) and offers extensive customization features for both efficient model inspection and the generation of high-quality renders fit for academic publications and presentations. EPShape intended for use by building energy modelers, particularly architects, engineers, and researchers in the building energy domain, across both academic and industry contexts.

# State of the field

Several programs are available for IDF visualization. EnergyPlus [@energyplus] natively supports `.dxf` file export from the `.idf` file, which can be viewed using CAD softwares. OpenStudio [@openstudio] supports importing `.idf` files for geometry visualization, but requires installation of a version matching the corresponding EnergyPlus version of the `.idf` file. Rhino, in combination with the Honeybee plugin [@ladybugtools], can import `.idf` file geometry as Rhino Breps, although this workflow involves a relatively complex setup process and requires a paid Rhino license.

# Software description

EPShape provides a wide range of tools that enable efficient model inspection and flexible rendering customization. Few examples are displayed in the following figures. Detailed descriptions and documentation are available in the [GitHub repository](https://github.com/chp-rubicell/EPShape). The source code is also archived in the [Zenodo repository](https://doi.org/10.5281/zenodo.16790187).

![The ability to toggle visibility of objects is crucial when inspecting models with a large number of zones. Visibilities of zones can be toggled individually, by specified height ranges, or both.\label{fig:vis}](vis.png)

![Various view customization options are provided for effective model inspection, as well as to enable rendering of the viewport into image files suitable for diverse purposes.\label{fig:set}](set.png)

![Surfaces can be colored based on either surface type or construction. The opacity and color of individual materials can be adjusted, enabling highlighting of specific constructions of interest for model inspection and debugging purposes.\label{fig:settype}](set-type.png)

# Software design

EPShape was developed in JavaScript and is deployed as a GitHub Pages web application ([https://chp-rubicell.github.io/epshape](https://chp-rubicell.github.io/epshape)). Although EPShape was primarily designed as a web-based application for ease of access and use, all functionalities are implemented in client-side JavaScript, and thus it can also be readily executed locally with `index.html` and the accompanying files located in the `resources/` directory.

Pre-processed `Energy+.idd` (Input Data Dictionary) files containing index information of fields necessary to extract shape and construction-related information from IDF files are loaded. After extracting the EnergyPlus version information from a given IDF file, the corresponding IDD object is fetched, and the parser iterates through the IDF code to create data structures containing various information such as zones, building surfaces, fenestrations, constructions, and boundary conditions.

EPShape uses `three.js` [@threejs] to render 3D previews. When parsing the IDF file, 3D representations of the objects are created and are stored in the data structures. This process includes adding holes to the building surfaces containing fenestration surfaces, triangulation of surfaces using `earcut` [@earcut], creating edge objects, shadow-casting objects, and so on. Finally, the 3D objects are pushed to the viewer to be rendered. The frame is updated whenever the camera is adjusted through mouse inputs, objects are highlighted, materials are changed, zone visibilities are toggled, and so on. In order to reduce computation, the data structures hold the 3D geometries and not the final meshes, which are created with appropriate materials whenever the model configuration is updated (view customization change, zone visibility toggle, etc.).

The data structures consist of `zoneList`, `surfList`, `fenList`, and `shadeList`, and the properties stored inside each entry are listed below:

**Zone object properties** (e.g., `zoneList['zoneName1']`):

- `Surfaces` : An array of surface names belonging to this zone.
- `Origin`
- `NDirection`
- `Visible`
- `ZBoundary` : An array of $(z_{min}, z_{max})$ boundary that is used for efficient checking when visibility mode is set to 'height range'.

**Surface object properties** (e.g., `surfList['surfName1']`):

- `SurfaceType`
- `Construction`
- `ZoneName` : Zone name to which the surface belongs.
- `OutsideBC` : 'Outside Boundary Condition' of the surface.
- `OutsideBCObj` : 'Outside Boundary Condition Object' of the surface.
- `VerticeNumber`
- `Vertices` : An $(n, 3)$ array of vertices.
- `Fenestrations` : An array of fenestration names belonging to this surface.
- `ZBoundary`
- `Geometries` : `THREE.BufferGeometry` objects of the surface that are triangulated w/ holes for fenestrations.
- `EdgeObjects` : `THREE.LineBasicMaterial` objects for showing edges.
- `EdgeObjects2` : `THREE.LineMaterial` objects that are similar to `EdgeObjects`, but have physical thicknesses that can be adjusted. Only used when 'Edge thickness' is turned on in the Settings panel.
- `ShadowObjects` : Invisible, shadow-casting meshes.

**Fenestration object properties** (e.g., `fenList['fenName1']`):

- `SurfaceType`
- `Construction`
- `SurfaceName`
- `OutsideBCObj`
- `VerticeNumber`
- `Vertices`
- `Geometries` : `THREE.BufferGeometry` objects of the fenestration surface (triangulated).
- `EdgeObjects`
- `EdgeObjects2`

**Shading object properties** (e.g., `shadeList['shadeName1']`):

- `VerticeNumber`
- `Vertices`
- `ZBoundary`
- `Geometries`
- `EdgeObjects`
- `ShadowObjects`

# Research impact statement

EPShape was initially hosted on a personal GitHub Pages repository ([https://github.com/chp-rubicell/chp-rubicell.github.io](https://github.com/chp-rubicell/chp-rubicell.github.io)) prior to the migration of its codebase to a dedicated repository. Since its release back in 2023, the tool has been adopted by multiple universities and research groups for purposes such as model inspection and debugging. Although these uses have not yet resulted in standalone publications due to the web-based nature of the tool, images generated by EPShape have been used in research papers (e.g., [@cho:2024] and [@choi:2023]). In addition, the project has received several non-coding contributions and feature requests from different countries since its initial release.

# AI usage disclosure

No generative AI tools were used in the development of this software. In writing this manuscript, ChatGPT (GPT-5) was used for language improvements in the form of minor grammar and style edits.

# References
