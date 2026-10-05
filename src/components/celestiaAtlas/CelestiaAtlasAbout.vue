<template>
  <!-- Credits and licence notices; rendered as the last section of the Atlas settings. -->
  <div class="w-full space-y-4 text-sm leading-6 text-gray-300">
    <section>
      <h4 class="mb-1 text-base font-semibold text-gray-100">Celestia Atlas</h4>
      <p>
        Touch-N-Stars uses the offline-first Celestia Atlas renderer and its packaged star and
        deep-sky catalogues.
      </p>
      <a
        class="break-all text-cyan-400 hover:underline"
        href="https://github.com/acocalypso/celestia_atlas"
        target="_blank"
        rel="noopener noreferrer"
      >
        github.com/acocalypso/celestia_atlas
      </a>
    </section>

    <section>
      <h4 class="mb-1 text-base font-semibold text-gray-100">Photographic sky survey</h4>
      <p>
        Digitized Sky Survey — STScI/NASA; colored and HiPS-processed by CDS (CNRS/Unistra). The
        survey is downloaded on request to the NINA/PINS host by the Touch-N-Stars plugin and served
        from there; the app itself does not fetch public survey tiles. Free for non-commercial use
        with attribution.
      </p>
      <a
        class="break-all text-cyan-400 hover:underline"
        href="https://outerspace.stsci.edu/spaces/MASTDATA/pages/176435492/Photographic+Sky+Surveys"
        target="_blank"
        rel="noopener noreferrer"
      >
        Photographic Sky Surveys attribution
      </a>
    </section>

    <section>
      <h4 class="mb-1 text-base font-semibold text-gray-100">Narrowband sky survey</h4>
      <p>
        Northern Sky Narrowband Survey (NSNS) DR0.2 by Stefan Ziegenbalg, [OIII], H-alpha and [SII]
        colour composite and single lines, licensed under CC BY-NC-SA 4.0
        (doi:10.3847/2515-5172/adfec7). The survey is downloaded on request to the NINA/PINS host by
        the Touch-N-Stars plugin, converted to JPEG there and served locally; the tiles are not
        redistributed.
      </p>
      <a
        class="break-all text-cyan-400 hover:underline"
        href="https://www.simg.de/nebulae3/dr0_2"
        target="_blank"
        rel="noopener noreferrer"
      >
        simg.de/nebulae3/dr0_2
      </a>
    </section>

    <section>
      <h4 class="mb-1 text-base font-semibold text-gray-100">Catalogue credits</h4>
      <p>
        Catalogue layers include HYG with HD identifiers (CC BY-SA 4.0), SIMBAD SAO
        cross-identifiers and Wolf-Rayet stars (ODbL 1.0), OpenNGC and the supplementary catalogue
        sources documented with Celestia Atlas. Full source and redistribution notices are included
        in the project documentation.
      </p>
    </section>
  </div>
</template>
