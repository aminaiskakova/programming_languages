package main

import (
	"crypto/sha3"
	"fmt"
	"math/rand"
	"os"
	"strconv"
	"sync"
	"sync/atomic"
	"time"
)

type Token struct {
	ID       int
	Data     string
	DstID    int
	DstHash  [32]byte
	TTL      int
	OriginID int
	Path     []int
	Created  time.Time
}

type Node struct {
	ID        int
	In        chan Token
	Out       chan Token
	Processed atomic.Int64
}

var (
	startTime   time.Time
	msgCounter  atomic.Int64
	totalCount  atomic.Int64
	uniqueCount atomic.Int64
	printMu     sync.Mutex
	rngMu       sync.Mutex
	rng         = rand.New(rand.NewSource(time.Now().UnixNano()))
)

func hashID(id int) [32]byte {
	return sha3.Sum256([]byte(strconv.Itoa(id)))
}

func ts() string {
	return fmt.Sprintf("[T+%04dms]", time.Since(startTime).Milliseconds())
}

func logf(format string, args ...any) {
	printMu.Lock()
	defer printMu.Unlock()
	fmt.Printf(format+"\n", args...)
}

func randInt(n int) int {
	rngMu.Lock()
	defer rngMu.Unlock()
	return rng.Intn(n)
}

func randomData() string {
	words := []string{"Тест", "Инфа", "Привет", "Пока", "Универ", "Сообщение", "Лаба"}
	return words[randInt(len(words))]
}

func makeToken(originID, dstID, ttl int, data string, path []int) Token {
	id := int(msgCounter.Add(1)) - 1
	cp := append([]int{}, path...)
	return Token{
		ID:       id,
		Data:     data,
		DstID:    dstID,
		DstHash:  hashID(dstID),
		TTL:      ttl,
		OriginID: originID,
		Path:     cp,
		Created:  time.Now(),
	}
}

func nodeName(id int) string {
	if id < 0 {
		return "Главный"
	}
	return fmt.Sprintf("Узел %d", id)
}

func (n *Node) run(nodes int, stop <-chan struct{}, all []*Node, wg *sync.WaitGroup) {
	defer wg.Done()

	for {
		select {
		case <-stop:
			logf("%s[%s] остановлен", ts(), nodeName(n.ID))
			return
		case tok := <-n.In:
			n.Processed.Add(1)
			totalCount.Add(1)

			if len(tok.Path) == 0 || tok.Path[len(tok.Path)-1] != n.ID {
				tok.Path = append(tok.Path, n.ID)
			}

			logf("%s[%s] [T+%dms] получено сообщение %d от %s через %v (TTL: %d, получатель: %s)",
				ts(), nodeName(n.ID), time.Since(tok.Created).Milliseconds(), tok.ID, nodeName(tok.OriginID), tok.Path, tok.TTL, nodeName(tok.DstID))

			if n.ID == tok.DstID {
				logf("%s[%s] Доставлено: %s за %d пересылки: %q",
					ts(), nodeName(n.ID), nodeName(tok.DstID), len(tok.Path), tok.Data)

				time.Sleep(100 * time.Millisecond)

				dst := randInt(nodes)
				if nodes > 1 {
					for dst == n.ID {
						dst = randInt(nodes)
					}
				}
				nextTTL := 5 + randInt(8)
				nextData := randomData()
				nextTok := makeToken(n.ID, dst, nextTTL, nextData, []int{n.ID})
				uniqueCount.Add(1)

				logf("%s[%s]      создание сообщения %d %s",
					ts(), nodeName(n.ID), nextTok.ID, nodeName(dst))

				select {
				case <-stop:
					return
				case all[n.ID].Out <- nextTok:
				}
				continue
			}

			if tok.TTL <= 1 {
				logf("%s[%s]      TTL истёк, сообщение %d удалено", ts(), nodeName(n.ID), tok.ID)
				continue
			}

			tok.TTL--
			next := (n.ID + 1) % nodes
			logf("%s[%s]      пересылка %s (TTL: %d)",
				ts(), nodeName(n.ID), nodeName(next), tok.TTL)

			select {
			case <-stop:
				return
			case all[n.ID].Out <- tok:
			}
		}
	}
}

func main() {
	nodes := 5
	if len(os.Args) > 1 {
		if v, err := strconv.Atoi(os.Args[1]); err == nil && v >= 2 {
			nodes = v
		}
	}

	startTime = time.Now()
	fmt.Printf("Число узлов: %d nodes\n\n", nodes)
	fmt.Println("Отправляем первое сообщение")

	all := make([]*Node, nodes)
	for i := 0; i < nodes; i++ {
		all[i] = &Node{
			ID: i,
			In: make(chan Token, 1),
		}
	}
	for i := 0; i < nodes; i++ {
		all[i].Out = all[(i+1)%nodes].In
	}

	stop := make(chan struct{})
	var wg sync.WaitGroup

	for i := 0; i < nodes; i++ {
		wg.Add(1)
		go all[i].run(nodes, stop, all, &wg)
	}

	first := makeToken(-1, 1, 10, "Тест", []int{-1})
	logf("%s[Главный] отправка сообщения %d Узлу %d через Узел %d",
		ts(), first.ID, first.DstID, 0)

	select {
	case all[0].In <- first:
	case <-time.After(1 * time.Second):
		logf("%s[Главный] не удалось отправить первое сообщение", ts())
		close(stop)
		wg.Wait()
		return
	}

	time.Sleep(5 * time.Second)
	logf("\nОстановка симуляции")
	close(stop)
	wg.Wait()

	fmt.Println("\nСтатистика")
	total := int64(0)
	for i := 0; i < nodes; i++ {
		c := all[i].Processed.Load()
		total += c
		fmt.Printf("Узел %d: %d сообщений\n", i, c)
	}
	fmt.Printf("Всего обработано сообщений: %d\n", total)
	fmt.Printf("Сгенерировано уникальных сообщений: %d\n", uniqueCount.Load()+1)
	fmt.Printf("Длительность симуляции: %.2f секунд\n", time.Since(startTime).Seconds())
}
