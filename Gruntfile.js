module.exports = function (grunt) {
  grunt.loadNpmTasks('grunt-webpack');
  grunt.loadNpmTasks('grunt-contrib-watch');

  grunt.initConfig({
    webpack: {
      options: {
        output: {
          library: "RippleVaultClient"
        }
      },
      web: {
        entry: {
          web: "./src/index.js"
        },
        output: {
          filename: "build/ripple-vault-client.js"
        }
      }
    },
    watch: {
      lib: {
        files: 'src/**/*.js',
        tasks: 'webpack'
      }
    }
  });

  grunt.registerTask('default', ['webpack']);
};
