/** @type { mm.PianoRollSVGVisualizer } */
var visualizer
var sequence = JSON.parse(localStorage.getItem('sequence'))
var player = new mm.Player(false, {
  run(note) {
    if (visualizer) visualizer.redraw(note, true)
  }
})
var model = new mm.MusicVAE('https://storage.googleapis.com/magentadata/js/checkpoints/music_vae/trio_4bar')
model.initialize().then(() => data.ready = true)

var project = {
  variables: [
    {
      name: 'main',
      expr: 'random()',
      randomize: true,
      randVals: null
    }
  ],
  parts: [
    { expr: 'main + random()' },
    { expr: 'main' },
    { expr: 'main + random()' },
    { expr: 'main' }
  ]
}
project = JSON.parse(localStorage.getItem('project')) || project

var data = {
  project,
  errors: {
    variables: Array(project.variables.length).fill(false),
    parts: Array(project.parts.length).fill(false)
  },
  ready: false,
  canPlay: sequence !== null,
  playing: false,
  instruments: 0
}

var app = new Vue({
  el: '#app',
  data,
  methods: {
    generate() {
      player.stop()

      tf.engine().startScope()
      const promises = []

      const vars = { }
      data.errors.variables = []
      project.variables.forEach(variable => {
        try {
          const out = evaluateExpression(variable.expr, vars, variable.randomize, variable.randVals)
          vars[variable.name] = out.result
          promises.push(
            Promise.all(randVals.map(rand => rand.array()))
            .then(randVals => {
              variable.randVals = randVals
            })
          )

          data.errors.variables.push(false)
          return out
        } catch (error) {
          data.errors.variables.push(error.message)
          throw error
        }
      })

      data.errors.parts = []
      const parts = project.parts.map(part => {
        try {
          const out = evaluateExpression(part.expr, vars, true)

          data.errors.parts.push(false)
          return out
        } catch (error) {
          data.errors.parts.push(error.message)
          throw error
        }
      })
      const tensorParts = []
      parts.forEach(part => {
        if (part.result instanceof tf.Tensor) tensorParts.push(part.result)
      })

      promises.push(
        model.decode(tf.stack(tensorParts))
        .then(results => {
          sequence = mm.sequences.concatenate(results)
          sequence = mm.sequences.unquantizeSequence(sequence)
          localStorage.setItem('sequence', JSON.stringify(sequence))
          visualizer = new mm.PianoRollSVGVisualizer(sequence, document.getElementById('viz'))
        })
      )

      Promise.all(promises).then(() => tf.engine().endScope())
    },
    addVariable(index) {
      const newVal = { name: '', expr: '', randomize: true, randVals: null }
      let newIndex = project.variables.length
      if (typeof index == 'number') {
        project.variables.splice(index, 0, newVal)
        newIndex = index + 1
      } else {
        project.variables.push(newVal)
      }
      
      this.$nextTick(() => {
        const el = document.getElementById('var-' + newIndex)
        el.firstChild.firstChild.focus()
      })
    },
    addPart(index) {
      const newVal = { expr: '' }
      let newIndex = project.variables.length
      if (typeof index == 'number') {
        newIndex = index + 1
        project.parts.splice(newIndex, 0, newVal)
      } else {
        project.parts.push(newVal)
      }

      this.$nextTick(() => {
        const el = document.getElementById('part-' + newIndex)
        el.firstChild.focus()
      })
    },
    keyEvent(typeKey, index, valueKey, event) {
      let value = project[typeKey][index][valueKey]

      if (event.key === 'Backspace' && value === '') {
        event.preventDefault()
        project[typeKey].splice(index, 1)

        this.$nextTick(() => {
          const el = document.getElementById('part-' + (index - 1))
          if (typeKey === 'variables') el.firstChild.firstChild.focus()
          else el.firstChild.focus()
        })
      } else if (event.key === 'Enter') {
        if (typeKey === 'variables') this.addVariable(index)
        else this.addPart(index)
      }
    },
    togglePlayback() {
      if (data.playing) {
        player.pause()
        data.playing = false
      } else {
        if (player.isPlaying()) player.resume()
        else player.start(sequence)
        data.playing = true
      } 
    },
    downloadMidi() {
      const cloneSequence = mm.sequences.quantizeNoteSequence(sequence)
      cloneSequence.notes.forEach(note => {
        if (!note.velocity) note.velocity = mm.constants.MAX_MIDI_VELOCITY

        if (note.instrument === 0) note.program = 81
        else if (note.instrument === 1) note.program = 38
      })
      const data = mm.sequenceProtoToMidi(cloneSequence)
      location.href = 'data:audio/midi;base64,' + btoa(String.fromCharCode.apply(null, data))
    }
  },
  watch: {
    $data: {
      deep: true,
      handler() {
        localStorage.setItem('project', JSON.stringify(project))
      }
    }
  },
  mounted() {
    if (sequence) visualizer = new mm.PianoRollSVGVisualizer(sequence, document.getElementById('viz'))
  }
})