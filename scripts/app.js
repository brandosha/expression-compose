/** @type { mm.PianoRollSVGVisualizer } */
var visualizer
var sequence = JSON.parse(localStorage.getItem('sequence'))
var player = new mm.Player(false, {
  run(note) {
    if (visualizer) visualizer.redraw(note, true)
  },
  stop() {
    data.playing = false
  }
})
var model = new mm.MusicVAE('https://storage.googleapis.com/magentadata/js/checkpoints/music_vae/trio_4bar')
model.initialize().then(() => data.ready = true)

const defaultProject = {
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
  ],
  temperature: 0.5,
  tempo: 120
}
var project = defaultProject

const storedProject = JSON.parse(localStorage.getItem('project'))
if (storedProject) project = Object.assign(defaultProject, storedProject)

var data = {
  project,
  errors: {
    variables: Array(project.variables.length).fill(false),
    parts: Array(project.parts.length).fill(false)
  },
  ready: false,
  canPlay: sequence !== null,
  playing: false,
  generating: false,
  instruments: 0
}

var darkMode = window.matchMedia('(prefers-color-scheme: dark)').matches
window.matchMedia('(prefers-color-scheme: dark)').onchange = (val) => {
  darkMode = val.matches
  app.updateVisualizer()
}

function visualizerConfig() {
  if (darkMode) {
    return { noteRGB: '180, 180, 180' }
  } else {
    return { noteRGB: '20, 20, 20' }
  }
}

var app = new Vue({
  el: '#app',
  data,
  methods: {
    generate() {
      if (data.generating) return
      data.generating = true
      
      player.stop()
      data.playing = false

      tf.engine().startScope()
      const promises = []

      const vars = { }
      data.errors.variables = []
      project.variables.forEach(variable => {
        try {
          if (/[0-9]/.test(variable.name[0])) throw new EvalError('Variable name cannot start with a number')
          if (/\s/.test(variable.name)) throw new EvalError('Variable name cannot include whitespace')

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

      const temperature = parseFloat(project.temperature)
      const tempo = parseInt(project.tempo)

      promises.push(
        model.decode(tf.stack(tensorParts), temperature, undefined, undefined, tempo)
        .then(results => {
          sequence = mm.sequences.concatenate(results)
          sequence = mm.sequences.unquantizeSequence(sequence)
          localStorage.setItem('sequence', JSON.stringify(sequence))
          this.updateVisualizer()
          
          data.generating = false
          data.canPlay = true
        })
      )

      Promise.all(promises).then(() => tf.engine().endScope())
    },
    updateVisualizer() {
      if (sequence)
        visualizer = new mm.PianoRollSVGVisualizer(
          sequence,
          document.getElementById('viz'),
          visualizerConfig()
        )
    },
    addVariable(index) {
      const newVal = { name: '', expr: '', randomize: true, randVals: null }
      let newIndex = project.variables.length
      if (typeof index == 'number') {
        newIndex = index + 1
        project.variables.splice(newIndex, 0, newVal)
      } else {
        project.variables.push(newVal)
      }
      
      this.$nextTick(() => this.focusEditor('variables', newIndex))
    },
    addPart(index) {
      const newVal = { expr: '' }
      let newIndex = project.parts.length
      if (typeof index == 'number') {
        newIndex = index + 1
        project.parts.splice(newIndex, 0, newVal)
      } else {
        project.parts.push(newVal)
      }

      this.$nextTick(() => this.focusEditor('parts', newIndex))
    },
    focusEditor(typeKey, index, valueKey) {
      if (typeKey === 'variables') {
        const el = document.getElementById('var-' + index)
        if (!el) return

        const childIndex = {
          'name': 0,
          'expr': 1
        }[valueKey] || 0
        el.children[childIndex].firstChild.focus()
      } else {
        const el = document.getElementById('part-' + index)
        if (!el) return

        el.firstChild.focus()
      }
    },
    keyEvent(typeKey, index, valueKey, event) {
      let value = project[typeKey][index][valueKey]

      if (event.key === 'Backspace' && value === '') {
        event.preventDefault()
        project[typeKey].splice(index, 1)

        this.$nextTick(() => this.focusEditor(typeKey, index - 1, valueKey))
      } else if (event.key === 'Enter') {
        if (typeKey === 'variables') this.addVariable(index)
        else this.addPart(index)
      } else if (event.key === 'ArrowUp') {
        this.focusEditor(typeKey, index - 1, valueKey)
      } else if (event.key === 'ArrowDown') {
        this.focusEditor(typeKey, index + 1, valueKey)
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
      const dataUrl = 'data:audio/midi;base64,' + btoa(String.fromCharCode.apply(null, data))

      const name = prompt('Enter the name of your project')
      if (!name) return
      
      const downloadLink = document.createElement('a')
      downloadLink.style.position = 'fixed'
      downloadLink.style.left = '-100px'
      downloadLink.href = dataUrl
      downloadLink.download = name + '.mid'
      downloadLink.click()
      downloadLink.remove()
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
    this.updateVisualizer()
  }
})