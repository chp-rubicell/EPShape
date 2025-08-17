# -*- coding: utf-8 -*-
#%%

import re

def format_to_str(items, level=0):

    output = ''
    INDENT = ' ' * 4
    
    if isinstance(items, list):
        # output += INDENT*level + '[\n'
        # for item in items:
        #     output += format_to_str(item, level+1)
        # output += INDENT*level + ']\n'

        output += INDENT*level + '['
        for item in items[:-1]:
            output += f'{item}, '
        output += str(items[-1])
        output += ']\n'

    elif isinstance(items, dict):
        output += INDENT*level + '{\n'
        for k, v in items.items():
            output += f'{INDENT*(level+1)}\'{k}\': \n'
            output += format_to_str(v, level+2)
        output += INDENT*level + '}\n'

    else:
        output = f'{INDENT*level}{items},\n'

    return output

#%%

version_list = ['7_2_0', '8_0_0', '8_1_0', '8_2_0', '8_3_0', '8_4_0', '8_5_0',
                '8_6_0', '8_7_0', '8_8_0', '8_9_0', '9_0_0', '9_1_0', '9_2_0',
                '9_3_0', '9_4_0', '9_5_0', '9_6_0', '22_1_0', '22_2_0']

test_string = r'''
ZoneGroup,
       \memo Adds a multiplier to a ZoneList. This can be used to reduce the amount of input
       \memo necessary for simulating repetitive structures, such as the identical floors of a
       \memo multi-story building.
       \min-fields 2
  A1 , \field Name
       \note Name of the Zone Group
       \required-field
       \type alpha
  A2,  \field Zone List Name
       \required-field
       \type object-list
       \object-list ZoneListNames
  N1;  \field Zone List Multiplier
       \type integer
       \default 1
       \minimum 1

BuildingSurface:Detailed,
  \memo Allows for detailed entry of building heat transfer surfaces. Does not include subsurfaces such as windows or doors.
  \extensible:3 -- duplicate last set of x,y,z coordinates (last 3 fields), remembering to remove ; from "inner" fields.
  \format vertices
  \min-fields 20
  A1 , \field Name
       \required-field
       \type alpha
       \reference SurfaceNames
       \reference SurfAndSubSurfNames
       \reference AllHeatTranSurfNames
       \reference OutFaceEnvNames
       \reference AllHeatTranAngFacNames
       \reference RadiantSurfaceNames
       \reference AllShadingAndHTSurfNames
       \reference FloorSurfaceNames
  A2 ; \field Surface Type
       \required-field
       \type choice
       \key Floor
'''


# p = re.compile(r'((?:\s*\S+\s*,(?:\s*\\.+\n)*)+\s*\S+\s*;(?:\s*\\.+\n)*)\n')
p = re.compile(r'((?:\s*\S+\s*,(?:\s*[!\\]+.+\n)*)+\s*\S+\s*;(?:\s*[!\\]+.+\n)*)\n')

library = {}

for version in version_list:
    print(version)

    curr_library = {}
    v = version.split('_')
    original_idd = open(f'idds/V{v[0]}-{v[1]}-{v[2]}-Energy+.idd', 'r', errors='ignore')
    idd_text = original_idd.read();
    original_idd.close()
    
    # items = p.findall(idd_text)
    items = p.findall(idd_text)
    for item in items:
        name, remaining = item.split(',', maxsplit=1)
        name = name.replace('\n', '').replace(' ', '')
        fields = re.findall(r'(\S+)\s*,\s*\\\s*field\s*(.+)\s*', remaining) + re.findall(r'(\S+)\s*;\s*\\\s*field\s*(.+)\s*', remaining)
        
        if name in ['Zone',
                    'Construction',
                    'BuildingSurface:Detailed',
                    'FenestrationSurface:Detailed',
                    'Shading:Building:Detailed']:
            curr_library[name.lower()] = [0] + [
                f[1].lower() for f in fields
                if (
                    f[1] == 'Vertex 1 X-coordinate'
                    or not (
                        f[1].startswith('Vertex')
                        and f[1].endswith('coordinate')
                    )
                )
            ]

    library[version] = curr_library

print(library)

with open('../resources/lib/iddLibrary.js', 'w', encoding='utf-8') as file:
    file.write('const versionLibrary = ' + str(library) + ';')

#%%
