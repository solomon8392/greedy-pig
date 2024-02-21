// 'use client'

import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { useMutation } from 'convex/react'
import { getSocket } from '@/lib/socket'
import {
  InputFunction,
  RollFunction,
  OutputFunction,
  playGame,
  UpdatePlayerInfo,
} from '@/lib/utils'
import { Roulette, useRoulette } from 'react-hook-roulette'
import { UpdatePlayerInfoPayload } from '@/features/leaderboard/leaderboardSlice'
import { useDispatch, useSelector } from 'react-redux'
import { addInput } from '@/lib/cartesi'
import { useRollups } from '@/hooks/useRollups'
import { dappAddress, getParticipantsForGame } from '@/lib/utils'
import ConfirmModal from './ConfirmModal'
import toast from 'react-hot-toast'
import { selectParticipantAddresses } from '@/features/games/gamesSlice'
import { api } from '@/convex/_generated/api'
import { useConnectContext } from '@/components/providers/ConnectProvider'
import Button from '../shared/Button'
import { useNotices } from '@/hooks/useNotices'


export default function AppRoullete() {

  const { notices } = useNotices()
  const { wallet } = useConnectContext()
  const addParticipant = useMutation(api.games.addParticipant)
  const searchParams = useSearchParams()
  const rollups = useRollups(dappAddress)
  // const players = useSelector((state: any) =>
  //   selectParticipantAddresses(state.games)
  // )
  const dispatch = useDispatch()

  const [gameId, setGameId] = useState<string>('')
  const [gameInProgress, setGameInProgress] = useState<boolean>(false)
  const [modalIsOpen, setModalIsOpen] = useState(false)
  const [modalQuestion, setModalQuestion] = useState('')
  const [handleUserInput, setHandleUserInput] = useState<
    (answer: string) => void
  >(() => () => {})
  const [rollResult, setRollResult] = useState<number | null>(null)
  const [isGameStarted, setIsGameStarted] = useState(false)
  const stopButtonRef = useRef<HTMLButtonElement | null>(null)
  const { roulette, onStart, onStop } = useRoulette({
    items: [
      { name: '1', bg: '#b26527', color: '#ffffff' },
      { name: '2', bg: '#ce9729', color: '#ffffff' },
      { name: '3', bg: '#e7c02b', color: '#ffffff' },
      { name: '4' },
      { name: '5' },
      { name: '6' },
    ],
    onSpinEnd: (res) => {
      setRollResult(Number(res))
    },
    options: {
      maxSpeed: 20,
      acceleration: 8,
      determineAngle: 90,
      style: {
        canvas: {
          bg: 'transparent',
        },
        arrow: {
          bg: '#000',
          size: 26,
        },
        label: {
          font: '28px Arial',
          align: 'right',
          baseline: 'middle',
          offset: 0.65,
          defaultColor: '#000',
        },
      },
    },
  })

  const openModal = () => setModalIsOpen(true)
  const closeModal = () => setModalIsOpen(false)

  const handleStopGame = () => {
    setIsGameStarted(false)
    onStop()
  }

  const getOutput: OutputFunction = (user: string, message: string) => {
    return new Promise(async (resolve) => {
      toast.success(`${user} ${message}`, {
        duration: 6000,
      })
      dispatch({ type: 'leaderboard/updateActivePlayer', payload: user })
   
      const socket = getSocket()
      if (socket) {
        socket.emit('activePlayer', user)
      }
      resolve(message)
    })
  }

  const getInput: InputFunction = async (question: string) => {
    return new Promise((resolve) => {
      setModalQuestion(question)
      openModal()

      const handleUserInput = (answer: string) => {
        closeModal()
        resolve(answer)
      }

      setHandleUserInput(() => handleUserInput)
    })
  }

  const startRouletteSpin = async () => {
    setIsGameStarted(true)
    onStart() // Start the roulette spinning
  }

  const getRoll: RollFunction = async () => {
    return new Promise((resolve) => {
      startRouletteSpin()

      setTimeout(() => {
        if (stopButtonRef.current) {
          stopButtonRef.current.click()

          setTimeout(() => {
            const rollResultElement = document.getElementById('roll-result')
            if (rollResultElement) {
              const rollResultValue = rollResultElement.innerText
              return resolve(Number(rollResultValue))
            }
          }, 500)
        }
      }, 2000)
    })
  }

  const startGame = async () => {
    setGameInProgress(true)
    const players = await getParticipantsForGame(gameId, notices)
    try {
      debugger
      const result = await playGame(
        players,
        getInput,
        getRoll,
        2,
        getOutput,
        updatePlayerInfo
      )


      setGameInProgress(false)
      toast.success(`Game finished!. ${result}`, {
        duration: 6000,
      })
      dispatch({ type: 'leaderboard/resetLeaderboard' })
    } catch (error) {
      console.error('Error during game:', error)
    }
  }

  const updatePlayerInfo: UpdatePlayerInfo = async (player: string, key: string, value: number ) => {

    const jsonPayload = JSON.stringify({
        method: 'updateParticipant',
        data: {player, key, value}
      })

       const tx = await addInput(
          JSON.stringify(jsonPayload),
          dappAddress,
          rollups
        )

        console.log('txxx ', tx)
        const result = await tx.wait(1)
        if (result) {
          console.log(result)
          // listen/emit event to update the leaderboardSlice. no mmore convex
        }

  }


  const joinGame = async (id: any) => {
    const addr: string = wallet?.accounts[0].address

      const jsonPayload = JSON.stringify({
        method: 'addParticipant',
        data: {gameId: id, playerAddress: addr}
      })
      

        const tx = await addInput(
          JSON.stringify(jsonPayload),
          dappAddress,
          rollups
        )

        console.log('txxx ', tx)
        const result = await tx.wait(1)
        if (result) {
           await addParticipant({data: {id, playerAddress: addr}})
        }

  }

  useEffect(() => {

    if (searchParams) {
      const action = searchParams.get('action')
      if (action === 'join') {
        const id = window.location.pathname.split('/').pop()

        if (id) {
          setGameId(id)
        }
       
      }
    }
  }, [searchParams])

  return (


    <div>
  

      <ConfirmModal onSubmit={handleUserInput} showModal={modalIsOpen} />

      {/* <Button className="mb-10" onClick={test} type="button"> */}
      <Button onClick={() => joinGame(gameId)} className="mb-10" type="button">
        Join Game
      </Button>
      <Button onClick={startGame} className="mb-10" type="button">
        Start Game
      </Button>

      <Roulette roulette={roulette} />
      {/* <RouletteWrapper onStart={onStart} onStop={onStop} /> */}

      <div className="hidden" id="roll-result">
        {rollResult}
      </div>
      <button
        className="hidden"
        ref={stopButtonRef}
        type="button"
        onClick={handleStopGame}
        disabled={!isGameStarted}
      />
    </div>
  )
}
