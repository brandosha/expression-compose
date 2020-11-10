
var darkMode = window.matchMedia('(prefers-color-scheme: dark)')
darkMode.onchange = () => visualize()

const urlElement = document.getElementById('url')
urlElement.value = location.href
function copyUrl() {
  urlElement.select()
  document.execCommand("copy")
}

var sequence
try {
  sequence = JSON.parse(atob(location.hash.slice(1)))
} catch (err) {
  alert('Invalid url')

  throw err
}

var visualizer
function visualize() {
  visualizer = new mm.PianoRollSVGVisualizer(
    sequence,
    document.getElementById('viz'),
    visualizerConfig()
  )
}
visualize()

var playing = false
var playbackButton = document.getElementById('playback-button')
var player = new mm.Player(false, {
  run(note) {
    if (visualizer) visualizer.redraw(note, true)
  },
  stop() {
    playing = false
    playbackButton.innerText = 'Play'
  }
})

function togglePlayback() {
  if (playing) {
    player.pause()
    playbackButton.innerText = 'Play'

    playing = false
  } else {
    if (player.isPlaying()) player.resume()
    else player.start(sequence)
    playbackButton.innerText = 'Pause'

    playing = true
  }
}

function visualizerConfig() {
  if (darkMode.matches) {
    return { noteRGB: '180, 180, 180' }
  } else {
    return { noteRGB: '20, 20, 20' }
  }
}
