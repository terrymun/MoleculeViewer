# MoleculeViewer

A simple but powerful molecule viewer for generating 3D models from simplified molecular-input line-entry system (SMILES) files. Implementation includes the [ChEmbl API](https://www.ebi.ac.uk/chembl/api/data/docs) and [Speck](https://github.com/wwwtyro/speck).

[**View live demo.**](https://terrymun.github.io/MoleculeViewer/)

## How to use

Create a plain text file containing a single line of <code>SMILES</code>, for example, for ciprofloxacin:

```
OC(=O)C1=CN(C2CC2)C2=CC(N3CCNCC3)=C(F)C=C2C1=O
```

Drop it onto the green dropzone on the page, and let MoleculeViewer do the rest of the work.

## Note

- MoleculeViewer only accepts plain text files, or files with the valid MIME type of `chemical/x-daylight-smiles`. If in doubt, a plain text file generated from a typical text editor will work.

## Acknowledgement
- [ChEmbl API](https://www.ebi.ac.uk/chembl/api/data/docs)
- [Speck](https://github.com/wwwtyro/speck)