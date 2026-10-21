module Jekyll
  module HideCustomBibtex
    # Drop internal fields (site.filtered_bibtex_keywords) from the BibTeX text.
    # Matches the field name only (`  key = {...}`), so e.g. `anim` does not eat
    # an author line containing "Animashree"; continuation lines of a removed
    # multi-line value are dropped too.
    def hideCustomBibtex(input)
      keywords = @context.registers[:site].config['filtered_bibtex_keywords']
      out = []
      skipping = false
      input.each_line do |line|
        if skipping
          skipping = false if line =~ /\},?\s*$/
          next
        end
        if keywords.any? { |k| line =~ /^\s*#{Regexp.escape(k)}\s*=/ }
          skipping = !(line =~ /\},?\s*$/)
          next
        end
        out << line
      end
      # @string venues carry display markup ("(<b>CVPR</b>),"); keep the BibTeX clean.
      out.join.gsub(%r{</?b>}, '').gsub(/,\}/, '}')
    end
  end
end

Liquid::Template.register_filter(Jekyll::HideCustomBibtex)
