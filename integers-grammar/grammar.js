module.exports = grammar({
  name: 'integer_list',

  rules: {
    source_file: $ => seq(
      optional($.integer_list),
      optional($._)
    ),

    integer_list: $ => seq(
      $.integer,
      repeat(seq(
        ',',
        optional($._),
        $.integer
      ))
    ),

    integer: $ => token(seq(
      optional('-'),
      /\d+/
    )),

    _: $ => choice(
      /\s+/,
      '//' /.*/,
      /\/\*[\s\S]*?\*/\
    )
  }
});